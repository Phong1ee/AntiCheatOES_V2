from __future__ import annotations

import os
import tempfile
from hashlib import sha256
from pathlib import Path
from unittest.mock import patch

from src.service.object_storage import ObjectNotFoundError, storage_for


class _FakeBody:
    def __init__(self, value: bytes):
        self.value = value

    def read(self) -> bytes:
        return self.value


class _MissingObject(Exception):
    response = {"Error": {"Code": "NoSuchKey"}}


class _FakeS3:
    def __init__(self):
        self.objects: dict[tuple[str, str], bytes] = {}

    def put_object(self, *, Bucket, Key, Body):
        self.objects[(Bucket, Key)] = Body

    def get_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise _MissingObject()
        return {"Body": _FakeBody(self.objects[(Bucket, Key)])}

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)


def test_local_storage_round_trip_and_cleanup():
    with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"OBJECT_STORAGE_BACKEND": "local"}, clear=False):
        storage = storage_for("imports", Path(directory))
        storage.put("source.xlsx", b"content")
        assert storage.get("source.xlsx") == b"content"
        assert storage.verify_sha256("source.xlsx", sha256(b"content").hexdigest())
        assert storage.delete("source.xlsx")
        assert not storage.exists("source.xlsx")


def test_s3_storage_uses_namespaced_keys_and_never_returns_paths():
    fake = _FakeS3()
    environment = {
        "OBJECT_STORAGE_BACKEND": "s3", "S3_ENDPOINT_URL": "https://bucket.example",
        "S3_ACCESS_KEY_ID": "test-key", "S3_SECRET_ACCESS_KEY": "test-secret", "S3_BUCKET": "oes-private",
    }
    with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, environment, clear=False):
        storage = storage_for("reports", Path(directory))
        with patch.object(storage, "_s3", return_value=(fake, "oes-private")):
            storage.put("report_job_7.xlsx", b"report")
            assert fake.objects[("oes-private", "reports/report_job_7.xlsx")] == b"report"
            assert storage.get("report_job_7.xlsx") == b"report"
            assert storage.delete("report_job_7.xlsx")
            try:
                storage.get("report_job_7.xlsx")
            except ObjectNotFoundError:
                pass
            else:
                raise AssertionError("missing S3 object must not be treated as an empty file")
