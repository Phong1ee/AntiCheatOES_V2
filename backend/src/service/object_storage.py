"""Private object storage shared by API replicas and background workers."""

from __future__ import annotations

from hashlib import sha256
import os
from pathlib import Path
import re
import tempfile
from typing import Iterator


class ObjectNotFoundError(FileNotFoundError):
    """Raised when an expected private object is no longer available."""


_KEY_PART = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$")


class ObjectStorage:
    def __init__(self, namespace: str, local_root: Path):
        self.namespace = namespace
        self.local_root = local_root.resolve()
        self.backend = os.getenv("OBJECT_STORAGE_BACKEND", "local").strip().lower()
        if self.backend not in {"local", "s3"}:
            raise RuntimeError("OBJECT_STORAGE_BACKEND must be local or s3")

    def _key(self, key: str) -> str:
        if not isinstance(key, str) or not _KEY_PART.fullmatch(key):
            raise ValueError("Invalid object storage key")
        return key

    def _local_path(self, key: str) -> Path:
        # `_key` excludes both path separators and traversal characters, so
        # joining it to the configured root cannot escape the root. Avoid
        # resolving here: concurrent first writes can race Windows resolution
        # of a directory that has not been created yet.
        return self.local_root / self._key(key)

    def _s3(self):
        if self.backend != "s3":
            return None
        endpoint = os.getenv("S3_ENDPOINT_URL", "").strip()
        access_key = os.getenv("S3_ACCESS_KEY_ID", "").strip()
        secret_key = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
        bucket = os.getenv("S3_BUCKET", "").strip()
        if not all((endpoint, access_key, secret_key, bucket)):
            raise RuntimeError("S3 storage requires S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET")
        import boto3

        return boto3.client(
            "s3", endpoint_url=endpoint, aws_access_key_id=access_key,
            aws_secret_access_key=secret_key, region_name=os.getenv("S3_REGION", "us-east-1").strip() or "us-east-1",
        ), bucket

    def _remote_key(self, key: str) -> str:
        return f"{self.namespace}/{self._key(key)}"

    def put(self, key: str, content: bytes) -> None:
        if not isinstance(content, bytes):
            raise TypeError("Object content must be bytes")
        if self.backend == "local":
            destination = self._local_path(key)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".object-", delete=False) as handle:
                handle.write(content)
                temporary = Path(handle.name)
            try:
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
            return
        client, bucket = self._s3()
        client.put_object(Bucket=bucket, Key=self._remote_key(key), Body=content)

    def get(self, key: str) -> bytes:
        if self.backend == "local":
            try:
                return self._local_path(key).read_bytes()
            except FileNotFoundError as exc:
                raise ObjectNotFoundError(key) from exc
        client, bucket = self._s3()
        try:
            return client.get_object(Bucket=bucket, Key=self._remote_key(key))["Body"].read()
        except Exception as exc:
            if getattr(exc, "response", {}).get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}:
                raise ObjectNotFoundError(key) from exc
            raise

    def exists(self, key: str) -> bool:
        try:
            self.get(key)
            return True
        except ObjectNotFoundError:
            return False

    def delete(self, key: str) -> bool:
        if self.backend == "local":
            path = self._local_path(key)
            if not path.is_file():
                return False
            path.unlink()
            return True
        if not self.exists(key):
            return False
        client, bucket = self._s3()
        client.delete_object(Bucket=bucket, Key=self._remote_key(key))
        return True

    def verify_sha256(self, key: str, expected: str) -> bool:
        return bool(re.fullmatch(r"[0-9a-fA-F]{64}", expected or "")) and sha256(self.get(key)).hexdigest() == expected.casefold()

    def local_path(self, key: str) -> Path:
        if self.backend != "local":
            raise RuntimeError("S3 objects do not have a shared local path")
        return self._local_path(key)


def storage_for(namespace: str, local_root: Path) -> ObjectStorage:
    return ObjectStorage(namespace, local_root)
