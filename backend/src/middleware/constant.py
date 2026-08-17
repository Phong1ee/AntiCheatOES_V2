import os


# SECRET_KEY = os.getenv("SECRET_KEY")
SECRET_KEY = "mysecretkey"
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be configured; refusing to use an insecure default.")
ALGORITHM = "HS256"
