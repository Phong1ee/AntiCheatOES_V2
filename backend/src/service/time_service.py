"""Shared clocks for the project's two established time domains."""

from datetime import datetime, timedelta, timezone


# Vietnam has a fixed UTC+07:00 offset and no daylight-saving transitions.
# A fixed offset keeps this helper runnable on Windows installations that do
# not ship the IANA timezone database, while the container still sets TZ for
# libraries that read the process timezone.
VIETNAM_TIME_ZONE = timezone(timedelta(hours=7), name="Asia/Ho_Chi_Minh")


def vietnam_now() -> datetime:
    """Return the Exam/business clock as a timezone-naive Vietnam-local value.

    Exam schedule columns intentionally store local wall-clock values.  Keeping
    this value naive preserves that API and database contract while making the
    source timezone explicit instead of depending on a host's clock setting.
    """
    return datetime.now(VIETNAM_TIME_ZONE).replace(tzinfo=None)


def utc_now() -> datetime:
    """Return an aware UTC timestamp for telemetry and external contracts."""
    return datetime.now(timezone.utc)
