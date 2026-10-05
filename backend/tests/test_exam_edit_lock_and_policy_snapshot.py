from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.models.teacher import examModel
from src.models.teacher.antiCheatPolicy import (
    default_anti_cheat_measures,
    make_anti_cheat_policy_snapshot,
)
from src.service.exam_version_service import claim_exam_version


def test_active_attempt_blocks_exam_manager_write_before_version_claim():
    db = MagicMock()
    db.get.return_value = SimpleNamespace(
        manage_by="T001", subject_id="SUB001", version=4,
    )
    db.query.return_value.filter.return_value.first.return_value = (99,)

    with patch("src.service.exam_version_service.require_active_subject_assignment"):
        with pytest.raises(HTTPException) as exc_info:
            claim_exam_version(db, 12, "T001", 4)

    assert exc_info.value.status_code == 409
    assert "attempt in progress" in str(exc_info.value.detail)


def test_attempt_policy_snapshot_does_not_read_later_exam_settings():
    snapshot = make_anti_cheat_policy_snapshot(
        True,
        5,
        {"COPY_ATTEMPT": {"enabled": True, "threshold": 3}},
    )
    attempt = {"attempt_id": 99, "exam_id": 12, "anti_cheat_policy_snapshot": snapshot}

    with patch.object(examModel, "getExamSettings") as get_settings:
        policy = examModel.getAttemptAntiCheatPolicy(attempt)

    assert policy["anti_cheat_enabled"] is True
    assert policy["anti_cheat_measures"]["COPY_ATTEMPT"]["threshold"] == 3
    get_settings.assert_not_called()


def test_attempt_policy_is_inactive_when_every_measure_is_disabled():
    measures = default_anti_cheat_measures()
    for measure in measures.values():
        measure["enabled"] = False
    snapshot = make_anti_cheat_policy_snapshot(
        True,
        5,
        measures,
    )

    assert snapshot["anti_cheat_enabled"] is False
