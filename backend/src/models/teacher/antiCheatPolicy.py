"""Server-owned anti-cheat policy definitions shared by settings and enforcement."""

import json
from typing import Any


ANTI_CHEAT_MEASURES: dict[str, dict[str, str]] = {
    "TAB_HIDDEN": {"label": "Leaving the exam tab", "group": "Browser"},
    "WINDOW_BLUR": {"label": "Leaving the exam window", "group": "Browser"},
    "FULLSCREEN_EXIT": {"label": "Exiting fullscreen", "group": "Browser"},
    "COPY_ATTEMPT": {"label": "Copy attempt", "group": "Browser"},
    "PASTE_ATTEMPT": {"label": "Paste attempt", "group": "Browser"},
    "CUT_ATTEMPT": {"label": "Cut attempt", "group": "Browser"},
    "PRINT_ATTEMPT": {"label": "Print attempt", "group": "Browser"},
    "BLOCKED_SHORTCUT": {"label": "Blocked browser shortcut", "group": "Browser"},
    "PAGE_REFRESH": {"label": "Refreshing the exam page", "group": "Browser"},
    "CAMERA_PERMISSION_DENIED": {"label": "Camera permission denied", "group": "Camera"},
    "CAMERA_TRACK_MUTED": {"label": "Camera paused or muted", "group": "Camera"},
    "CAMERA_TRACK_ENDED": {"label": "Camera stopped", "group": "Camera"},
    "NO_FACE_DETECTED": {"label": "No face detected", "group": "Camera"},
    "MULTIPLE_FACES_DETECTED": {"label": "Multiple faces detected", "group": "Camera"},
    "GAZE_AWAY_SUSTAINED": {"label": "Looking away for an extended period", "group": "Camera"},
    "HEAD_AWAY_SUSTAINED": {"label": "Head turned away for an extended period", "group": "Camera"},
    "MIC_PERMISSION_DENIED": {"label": "Microphone permission denied", "group": "Microphone"},
    "MIC_TRACK_MUTED": {"label": "Microphone muted", "group": "Microphone"},
    "MIC_TRACK_ENDED": {"label": "Microphone stopped", "group": "Microphone"},
    "MULTIPLE_VOICES_DETECTED": {"label": "Multiple voices detected", "group": "Microphone"},
}

_CAMERA_RULE_EVENTS = {"NO_FACE_DETECTED", "MULTIPLE_FACES_DETECTED"}
_MICROPHONE_RULE_EVENTS = {"MULTIPLE_VOICES_DETECTED"}


def default_anti_cheat_measures(threshold: int = 5) -> dict[str, dict[str, int | bool]]:
    """Return a complete policy, preserving the legacy shared limit as its default."""
    threshold = min(max(int(threshold or 5), 1), 100)
    policy = {event_type: {"enabled": True, "threshold": threshold} for event_type in ANTI_CHEAT_MEASURES}
    for event_type, definition in ANTI_CHEAT_MEASURES.items():
        if definition["group"] == "Camera" and event_type not in _CAMERA_RULE_EVENTS:
            policy[event_type]["enabled"] = False
        if definition["group"] == "Microphone" and event_type not in _MICROPHONE_RULE_EVENTS:
            policy[event_type]["enabled"] = False
    return policy


def normalize_anti_cheat_measures(value: Any, legacy_threshold: int = 5) -> dict[str, dict[str, int | bool]]:
    """Make null, legacy, and partially populated JSON policies safe to enforce."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = None
    normalized = default_anti_cheat_measures(legacy_threshold)
    if not isinstance(value, dict):
        return normalized
    for event_type, measure in value.items():
        if event_type not in normalized or not isinstance(measure, dict):
            continue
        enabled = measure.get("enabled")
        threshold = measure.get("threshold")
        if isinstance(enabled, bool):
            normalized[event_type]["enabled"] = enabled
        if isinstance(threshold, int) and not isinstance(threshold, bool):
            normalized[event_type]["threshold"] = min(max(threshold, 1), 100)
    # Health and gaze events are not exposed as Teacher rules, so they never
    # become hidden violations. Camera and microphone enforcement is limited
    # to the rules presented in the grouped settings UI.
    for event_type, definition in ANTI_CHEAT_MEASURES.items():
        if definition["group"] == "Camera" and event_type not in _CAMERA_RULE_EVENTS:
            normalized[event_type]["enabled"] = False
        if definition["group"] == "Microphone" and event_type not in _MICROPHONE_RULE_EVENTS:
            normalized[event_type]["enabled"] = False
    return normalized


def make_anti_cheat_policy_snapshot(
    anti_cheat_enabled: Any,
    violation_limit: Any,
    anti_cheat_measures: Any,
) -> dict[str, Any]:
    """Freeze the complete, server-normalized policy for one Attempt."""
    limit = min(max(int(violation_limit or 5), 1), 100)
    return {
        "anti_cheat_enabled": bool(anti_cheat_enabled),
        "violation_limit": limit,
        "anti_cheat_measures": normalize_anti_cheat_measures(anti_cheat_measures, limit),
    }


def normalize_anti_cheat_policy_snapshot(value: Any) -> dict[str, Any] | None:
    """Return a safe attempt snapshot, or None for legacy attempts without one."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    if not isinstance(value, dict):
        return None
    if not {"anti_cheat_enabled", "violation_limit", "anti_cheat_measures"}.issubset(value):
        return None
    return make_anti_cheat_policy_snapshot(
        value["anti_cheat_enabled"],
        value["violation_limit"],
        value["anti_cheat_measures"],
    )
