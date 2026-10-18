from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://findback:findback_local@127.0.0.1:5432/findback?connect_timeout=5"
    frontend_url: str = "http://localhost:5173"
    allowed_origins: str = "http://localhost:5173,http://localhost:8000"
    cookie_secure: bool = False
    storage_backend: Literal["local", "s3"] = "local"
    storage_path: Path = Path("storage")
    s3_bucket: str = ""
    s3_endpoint_url: str | None = None
    s3_region: str = "ap-southeast-1"
    email_backend: Literal["smtp", "log"] = "smtp"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    email_from: str = "FindBack <noreply@findback.local>"
    worker_poll_seconds: float = 2
    worker_max_attempts: int = 5
    worker_lease_seconds: int = 120
    allow_demo_email: bool = False
    rate_limit_enabled: bool = True

    @property
    def origins(self) -> list[str]:
        return [v.strip() for v in self.allowed_origins.split(",") if v.strip()]

    def validate_production(self) -> None:
        if self.environment == "production":
            frontend = urlsplit(self.frontend_url)
            if not self.cookie_secure or frontend.scheme != "https" or not frontend.hostname or frontend.username or frontend.password or frontend.query or frontend.fragment or frontend.path not in {"", "/"}:
                raise RuntimeError("Production requires HTTPS and COOKIE_SECURE=true")
            if self.storage_backend != "s3" or not self.s3_bucket:
                raise RuntimeError("Production requires private S3-compatible storage")
            if self.email_backend != "smtp" or self.allow_demo_email:
                raise RuntimeError("Production requires SMTP and demo email disabled")
            if not self.smtp_tls or not self.smtp_username or not self.smtp_password:
                raise RuntimeError("Production requires authenticated SMTP over TLS")
            if not self.database_url.startswith("postgresql") or "findback_local" in self.database_url:
                raise RuntimeError("Production requires a configured PostgreSQL credential")
            if not self.origins or self.frontend_url.rstrip("/") not in self.origins:
                raise RuntimeError("Production origins must include the frontend origin")
            for origin in self.origins:
                parsed = urlsplit(origin)
                if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment or "*" in origin:
                    raise RuntimeError("Production origins must be exact HTTPS origins")
            if self.smtp_host in {"localhost", "127.0.0.1", "mailpit"} or self.email_from.endswith("@findback.local>"):
                raise RuntimeError("Production requires a real SMTP host and sender")
            if self.worker_lease_seconds <= 20 or self.worker_poll_seconds <= 0 or self.worker_max_attempts < 1:
                raise RuntimeError("Worker lease must exceed SMTP timeout and retry settings must be positive")


@lru_cache
def get_settings() -> Settings:
    return Settings()
