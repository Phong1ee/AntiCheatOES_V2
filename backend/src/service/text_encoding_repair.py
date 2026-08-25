from __future__ import annotations

from typing import Any


# UTF-8 Vietnamese bytes decoded as CP437 produce box-drawing characters.
_CP437_MOJIBAKE_MARKERS = set("\u2500\u2502\u2514\u251c\u2524\u2550\u2551\u2557\u255a\u255d\u255e\u2560\u2563\u2566\u2569\u256c\u2591\u2592\u2593\u0192\u00df\u00ed")
_VIETNAMESE_MARKERS = set(
    "\u0103\u00e2\u00ea\u00f4\u01a1\u01b0\u0111"
    "\u00e1\u00e0\u1ea3\u00e3\u1ea1\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7"
    "\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u00e9\u00e8\u1ebb\u1ebd\u1eb9"
    "\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7\u00ed\u00ec\u1ec9\u0129\u1ecb"
    "\u00f3\u00f2\u1ecf\u00f5\u1ecd\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9"
    "\u1edb\u1edd\u1edf\u1ee1\u1ee3\u00fa\u00f9\u1ee7\u0169\u1ee5"
    "\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u00fd\u1ef3\u1ef7\u1ef9\u1ef5"
).union({character.upper() for character in "\u0103\u00e2\u00ea\u00f4\u01a1\u01b0\u0111"})


def repair_cp437_mojibake(value: str) -> str:
    """Return a repaired Vietnamese string only for the known reversible corruption."""
    if not value or not any(character in _CP437_MOJIBAKE_MARKERS for character in value):
        return value

    try:
        repaired = value.encode("cp437").decode("utf-8")
    except UnicodeError:
        return value

    # Do not alter legitimate box-drawing or other CP437 text by accident.
    if any(character in _VIETNAMESE_MARKERS for character in repaired):
        return repaired
    return value


def repair_json_value(value: Any) -> Any:
    """Recursively repair text inside JSON snapshots without changing their shape."""
    if isinstance(value, str):
        return repair_cp437_mojibake(value)
    if isinstance(value, list):
        return [repair_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_json_value(item) for key, item in value.items()}
    return value
