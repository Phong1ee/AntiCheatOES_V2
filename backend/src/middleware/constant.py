import os


SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
_INSECURE_SECRET_VALUES = {
    "",
    "mysecretkey",
    "replace-with-a-long-random-secret",
    "change-me",
}
if SECRET_KEY.lower() in _INSECURE_SECRET_VALUES or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY must be a non-placeholder, cryptographically random value of at least 32 characters."
    )
ALGORITHM = "HS256"
