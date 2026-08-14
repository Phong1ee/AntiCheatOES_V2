from src.service.audit_catalog import audit_action_info


def test_internal_worker_actions_are_hidden_and_unknown_actions_remain_displayable():
    assert audit_action_info("EXAM_CREATED") == {
        "label": "Exam Created", "category": "EXAM_MANAGEMENT", "visible_to_admin": True,
    }
    assert audit_action_info("ANTI_CHEAT_ANALYTICS_RECORDED")["visible_to_admin"] is False
    assert audit_action_info("legacy.custom") == {
        "label": "Legacy.Custom", "category": "SYSTEM", "visible_to_admin": True,
    }
