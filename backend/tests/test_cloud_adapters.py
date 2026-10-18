"""Exercise cloud failure behavior and TLS verification without AWS credentials."""
import io
import ssl
from unittest.mock import MagicMock, patch

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.storage.adapters import S3Storage
from app.workers.notifications import send_email


def s3_adapter():
    adapter = object.__new__(S3Storage)
    adapter.bucket = "test-private-bucket"
    adapter.client = boto3.client("s3", region_name="ap-southeast-1", aws_access_key_id="testing", aws_secret_access_key="testing")
    return adapter


def test_missing_s3_image_becomes_not_found():
    adapter = s3_adapter()
    with Stubber(adapter.client) as stub:
        stub.add_client_error("get_object", service_error_code="NoSuchKey", http_status_code=404,
                              expected_params={"Bucket": adapter.bucket, "Key": "missing.jpg"})
        with pytest.raises(FileNotFoundError):
            adapter.get("missing.jpg")


def test_s3_stream_is_closed_after_read():
    adapter = s3_adapter()
    stream = io.BytesIO(b"test-image")
    with Stubber(adapter.client) as stub:
        stub.add_response("get_object", {"Body": StreamingBody(stream, 10)},
                          {"Bucket": adapter.bucket, "Key": "image.jpg"})
        assert adapter.get("image.jpg") == b"test-image"
    assert stream.closed


def test_smtp_verifies_server_certificate(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "email_backend", "smtp")
    monkeypatch.setattr(settings, "smtp_tls", True)
    monkeypatch.setattr(settings, "smtp_username", "test-user")
    monkeypatch.setattr(settings, "smtp_password", "test-password")
    smtp = MagicMock()
    with patch("app.workers.notifications.smtplib.SMTP") as constructor:
        constructor.return_value.__enter__.return_value = smtp
        send_email("fictional@example.com", "Test", "Synthetic message", "test-event")
    context = smtp.starttls.call_args.kwargs["context"]
    assert context.check_hostname
    assert context.verify_mode == ssl.CERT_REQUIRED
    smtp.send_message.assert_called_once()


def production_settings(**overrides):
    values = dict(environment="production", cookie_secure=True, frontend_url="https://findback.example.com",
                  allowed_origins="https://findback.example.com", storage_backend="s3", s3_bucket="private-bucket",
                  database_url="postgresql+psycopg://app:testing@db.example.com/findback?sslmode=require",
                  email_backend="smtp", smtp_host="smtp.example.com", smtp_tls=True,
                  smtp_username="testing", smtp_password="testing", email_from="FindBack <alerts@example.com>",
                  allow_demo_email=False)
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_valid_production_configuration():
    production_settings().validate_production()


@pytest.mark.parametrize("overrides", [
    {"allowed_origins": ""},
    {"allowed_origins": "https://*.example.com"},
    {"allowed_origins": "https://findback.example.com/path"},
    {"frontend_url": "https://findback.example.com/reset-password"},
    {"smtp_host": "mailpit"},
    {"worker_lease_seconds": 20},
    {"cookie_secure": False},
])
def test_unsafe_production_configuration_is_rejected(overrides):
    with pytest.raises(RuntimeError):
        production_settings(**overrides).validate_production()


def test_environment_typo_cannot_bypass_production_guards():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="prodution")
