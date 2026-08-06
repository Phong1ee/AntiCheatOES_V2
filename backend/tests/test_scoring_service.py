from decimal import Decimal

import pytest

from src.service.scoring_service import (
    normalize_score,
    validate_awarded_score,
    validate_max_score,
)


@pytest.mark.parametrize(
    ("earned", "possible", "expected"),
    [
        ("13", "13", Decimal("100.00")),
        ("11.5", "13", Decimal("88.46")),
        ("0", "13", Decimal("0.00")),
        ("14", "13", Decimal("100.00")),
        (Decimal("0.1") + Decimal("0.2"), "0.3", Decimal("100.00")),
    ],
)
def test_normalize_score_uses_decimal_and_rounds_once(earned, possible, expected):
    assert normalize_score(earned, possible) == expected


def test_normalize_score_rejects_zero_denominator():
    with pytest.raises(ValueError, match="positive"):
        normalize_score("1", "0")


def test_normalize_score_rejects_negative_earned_score():
    with pytest.raises(ValueError, match="negative"):
        normalize_score("-1", "10")


def test_max_and_awarded_score_validation_support_decimals():
    maximum = validate_max_score("2.75")
    assert validate_awarded_score("1.25", maximum) == Decimal("1.25")
    with pytest.raises(ValueError, match="between"):
        validate_awarded_score("2.76", maximum)
    with pytest.raises(ValueError, match="between"):
        validate_awarded_score("-0.01", maximum)
