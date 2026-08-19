import os
from pathlib import Path

from dotenv import load_dotenv


# Authentication settings are imported before the database module, so load the
# backend-local environment file here rather than depending on import order.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be configured; refusing to use an insecure default.")
ALGORITHM = "HS256"
