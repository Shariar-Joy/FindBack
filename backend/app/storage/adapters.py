import io
import secrets
import warnings
from pathlib import Path
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from botocore.exceptions import ClientError
from app.core.config import get_settings

MAX_IMAGE_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000


def clean_image(data: bytes) -> bytes:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(422, "Choose a JPEG, PNG or WebP image under 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Unsupported image")
                image.load()
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((1600, 1600))
                # A new image discards EXIF, GPS, comments and ancillary metadata.
                clean = Image.new("RGB", image.size)
                clean.paste(image)
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=88)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "The file is not a supported, safe image.")


class LocalStorage:
    def path(self, key: str) -> Path:
        if not key.endswith(".jpg") or any(c not in "abcdef0123456789." + "jpg" for c in key) or "/" in key or "\\" in key:
            raise ValueError("Invalid object key")
        return get_settings().storage_path / key

    def put(self, data: bytes) -> str:
        key = secrets.token_hex(24) + ".jpg"
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self.path(key).read_bytes()

    def delete(self, key: str):
        self.path(key).unlink(missing_ok=True)


class S3Storage:
    def __init__(self):
        import boto3
        s = get_settings()
        if not s.s3_bucket:
            raise RuntimeError("S3_BUCKET is required")
        self.client = boto3.client("s3", endpoint_url=s.s3_endpoint_url or None, region_name=s.s3_region)
        self.bucket = s.s3_bucket

    def put(self, data: bytes) -> str:
        key = secrets.token_hex(24) + ".jpg"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType="image/jpeg", ServerSideEncryption="AES256")
        return key

    def get(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}:
                raise FileNotFoundError("Image not found") from exc
            raise
        body = response["Body"]
        try:
            return body.read()
        finally:
            body.close()

    def delete(self, key: str):
        self.client.delete_object(Bucket=self.bucket, Key=key)


def storage():
    mode = get_settings().storage_backend
    if mode == "s3":
        return S3Storage()
    if mode == "local" and get_settings().environment != "production":
        return LocalStorage()
    raise RuntimeError("Unsupported storage configuration")
