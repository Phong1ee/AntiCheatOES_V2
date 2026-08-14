"""Private local storage for files awaiting Admin bulk-data review."""

from __future__ import annotations

from hashlib import sha256
import os
from pathlib import Path
import re
import tempfile
from uuid import uuid4
from src.service.object_storage import ObjectNotFoundError, storage_for


_ALLOWED_SUFFIXES = {".docx", ".pdf", ".xlsx"}
_STORED_KEY_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:docx|pdf|xlsx)$"
)


def storage_root() -> Path:
    """Resolve the configured storage root relative to the backend when needed."""
    configured = os.getenv("BULK_DATA_REQUEST_STORAGE_DIR", "generated_bulk_requests").strip()
    root = Path(configured or "generated_bulk_requests")
    if not root.is_absolute():
        root = Path(__file__).resolve().parents[2] / root
    return root.resolve()


def _validated_suffix(original_filename: str) -> str:
    suffix = Path(original_filename).suffix.casefold()
    if suffix not in _ALLOWED_SUFFIXES:
        raise ValueError("Unsupported bulk data request file type")
    return suffix


def _validated_path(stored_file_key: str) -> Path:
    if not isinstance(stored_file_key, str) or not _STORED_KEY_PATTERN.fullmatch(stored_file_key):
        raise ValueError("Invalid bulk data request file key")
    root = storage_root()
    path = (root / stored_file_key).resolve()
    if path.parent != root:
        raise ValueError("Bulk data request file key escapes storage root")
    return path


def _storage():
    return storage_for("bulk-data-requests", storage_root())


def save(content: bytes, original_filename: str) -> str:
    """Write bytes atomically under a generated UUID key and return that key."""
    if not isinstance(content, bytes):
        raise TypeError("Bulk data request content must be bytes")
    suffix = _validated_suffix(original_filename)
    stored_file_key = f"{uuid4()}{suffix}"
    _storage().put(stored_file_key, content)
    return stored_file_key


def path_for(stored_file_key: str) -> Path:
    """Return a validated internal path; callers must never expose it in APIs."""
    return _storage().local_path(stored_file_key)


def read(stored_file_key: str) -> bytes:
    return _storage().get(stored_file_key)


def exists(stored_file_key: str) -> bool:
    return _storage().exists(stored_file_key)


def delete(stored_file_key: str) -> bool:
    return _storage().delete(stored_file_key)


def verify_sha256(stored_file_key: str, expected_sha256: str) -> bool:
    """Check stored contents against the digest kept in the request record."""
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
        return False
    try:
        return _storage().verify_sha256(stored_file_key, expected_sha256)
    except ObjectNotFoundError:
        return False
