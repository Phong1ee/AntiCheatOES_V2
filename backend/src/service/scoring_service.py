from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


GRADING_SCALE = Decimal("10.00")
SCORE_QUANTUM = Decimal("0.01")
CURRENT_SCORE_SCALE_VERSION = 2


def decimal_score(value: Decimal | int | str | float | None, *, field_name: str) -> Decimal:
    if value is None or isinstance(value, bool):
        raise ValueError(f"{field_name} is required")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{field_name} must be numeric") from exc


def normalize_score(
    raw_earned: Decimal | int | str | float,
    raw_possible: Decimal | int | str | float,
    scale: Decimal = GRADING_SCALE,
) -> Decimal:
    """Normalize exact raw totals once, using ROUND_HALF_UP, onto the fixed scale."""
    earned = decimal_score(raw_earned, field_name="raw_earned_score")
    possible = decimal_score(raw_possible, field_name="raw_possible_score")
    normalized_scale = decimal_score(scale, field_name="grading_scale")
    if earned < 0:
        raise ValueError("raw_earned_score must not be negative")
    if possible <= 0:
        raise ValueError("raw_possible_score must be positive")
    if normalized_scale <= 0:
        raise ValueError("grading_scale must be positive")
    normalized = (earned / possible) * normalized_scale
    clamped = min(max(normalized, Decimal("0")), normalized_scale)
    return clamped.quantize(SCORE_QUANTUM, rounding=ROUND_HALF_UP)


def validate_max_score(value: Decimal | int | str | float) -> Decimal:
    maximum = decimal_score(value, field_name="max_score")
    if maximum <= 0:
        raise ValueError("max_score must be positive")
    return maximum


def validate_awarded_score(
    awarded: Decimal | int | str | float,
    maximum: Decimal | int | str | float,
) -> Decimal:
    score = decimal_score(awarded, field_name="awarded_score")
    max_score = validate_max_score(maximum)
    if score < 0 or score > max_score:
        raise ValueError(f"awarded_score must be between 0 and {max_score}")
    return score
