"""Send one test email to check the SMTP settings in backend/.env.

    cd backend
    python scripts/send_test_email.py you@example.com

Reports what it is about to do first - host, port, sender, and whether a
password is set - without ever printing the password itself. Exits non-zero on
failure so it can be used as a check.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_ROOT / ".env")

# _env, not os.getenv: settings can come from .env OR the shared .env.example,
# and a report that only looked at the environment would print (none) for
# values the sender is really using.
from src.service.email_service import _env, send_email, smtp_is_configured  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    recipient = sys.argv[1]

    if not smtp_is_configured():
        print("SMTP_HOST is set neither in backend/.env nor in backend/.env.example.")
        print("Nothing will be sent - the app logs the reset code instead.")
        print("Fill in the SMTP_* block in either file.")
        return 1

    print(f"host      : {_env('SMTP_HOST')}:{_env('SMTP_PORT', '587')}")
    print(f"username  : {_env('SMTP_USERNAME') or '(none)'}")
    # Length only. Printing the value would put an app password in the console
    # scrollback and in any CI log this ever runs in.
    password = _env("SMTP_PASSWORD")
    print(f"password  : {'set, ' + str(len(password)) + ' characters' if password else '(none)'}")
    print(f"from      : {_env('SMTP_FROM') or _env('SMTP_USERNAME') or '(none)'}")
    print(f"starttls  : {_env('SMTP_USE_STARTTLS', 'true')}   ssl: {_env('SMTP_USE_SSL', 'false')}")
    print(f"to        : {recipient}")
    print()

    try:
        send_email(
            recipient,
            "OES SMTP test",
            "This is a test message from the OES backend.\n"
            "If you are reading it, password reset codes will be delivered.\n",
        )
    except Exception as error:
        print(f"FAILED: {type(error).__name__}: {error}")
        print()
        print("Common causes:")
        print("  535 / auth failed  - Gmail needs an App Password, not your account password")
        print("  timeout            - wrong port, or the network blocks outbound SMTP")
        print("  SSL/STARTTLS error - port 465 needs SMTP_USE_SSL=true, 587 needs STARTTLS")
        return 1

    print("Sent. Check the inbox, and the spam folder.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
