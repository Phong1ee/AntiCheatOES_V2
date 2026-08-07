"""Server-owned anti-cheat event classification and bounded metadata rules."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


EVENT_POLICY_VERSION = "1"
MAX_METADATA_BYTES = 4096


@dataclass(frozen=True)
class MetadataField:
    kind: type | tuple[type, ...]
    minimum: float | None = None
    maximum: float | None = None
    max_length: int | None = None


@dataclass(frozen=True)
class EventPolicy:
    allowed_sources: frozenset[str]
    counts_toward_limit: bool
    automated_flag: bool
    metadata_schema: dict[str, MetadataField]
    required_metadata: frozenset[str] = frozenset()


STRING_FIELDS = {
    "detectorName": MetadataField(str, max_length=80),
    "detectorVersion": MetadataField(str, max_length=80),
    "modelVersion": MetadataField(str, max_length=80),
    "policyVersion": MetadataField(str, max_length=40),
    "incidentId": MetadataField(str, max_length=64),
    "categoryName": MetadataField(str, max_length=100),
    "sampleTimestamp": MetadataField(str, max_length=64),
}
NUMERIC_FIELDS = {
    "confidence": MetadataField((int, float), minimum=0, maximum=1),
    "durationMs": MetadataField((int, float), minimum=0, maximum=600_000),
    "threshold": MetadataField((int, float), minimum=-200, maximum=1_000_000),
    "cooldownMs": MetadataField((int, float), minimum=0, maximum=3_600_000),
    "faceCount": MetadataField((int, float), minimum=0, maximum=10),
    "faceBoxRatio": MetadataField((int, float), minimum=0, maximum=1),
    "qualityScore": MetadataField((int, float), minimum=0, maximum=1),
    "yawDegrees": MetadataField((int, float), minimum=-180, maximum=180),
    "pitchDegrees": MetadataField((int, float), minimum=-180, maximum=180),
    "rollDegrees": MetadataField((int, float), minimum=-180, maximum=180),
    "shoulderVisibility": MetadataField((int, float), minimum=0, maximum=1),
    "baselineLevel": MetadataField((int, float), minimum=-200, maximum=200),
    "observedLevel": MetadataField((int, float), minimum=-200, maximum=200),
}

_INCIDENT_FIELDS = {**STRING_FIELDS, **NUMERIC_FIELDS}
_HEALTH_FIELDS = {key: _INCIDENT_FIELDS[key] for key in ("policyVersion", "incidentId", "durationMs", "cooldownMs", "sampleTimestamp")}
_VISION_FIELDS = {key: _INCIDENT_FIELDS[key] for key in (
    "detectorName", "detectorVersion", "modelVersion", "policyVersion", "incidentId",
    "confidence", "durationMs", "threshold", "cooldownMs", "faceCount", "faceBoxRatio",
    "qualityScore", "yawDegrees", "pitchDegrees", "rollDegrees", "shoulderVisibility",
    "categoryName", "sampleTimestamp",
)}
_AUDIO_FIELDS = {key: _INCIDENT_FIELDS[key] for key in (
    "detectorName", "detectorVersion", "modelVersion", "policyVersion", "incidentId",
    "confidence", "durationMs", "threshold", "cooldownMs", "categoryName", "baselineLevel",
    "observedLevel", "sampleTimestamp",
)}
_AUTOMATED_REQUIRED = frozenset({"detectorName", "detectorVersion", "modelVersion", "policyVersion", "incidentId"})


def _policy(source: str, *, counts: bool, automated: bool, metadata: dict[str, MetadataField], required: frozenset[str] = frozenset()) -> EventPolicy:
    return EventPolicy(frozenset({source}), counts, automated, metadata, required)


# Browser events remain explicit for backward-compatible monitoring. All client
# event admission and classification is derived from this one mapping.
EVENT_POLICY: dict[str, EventPolicy] = {
    **{event: _policy("browser", counts=True, automated=False, metadata=_HEALTH_FIELDS) for event in (
        "TAB_HIDDEN", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY_ATTEMPT", "PASTE_ATTEMPT",
        "CUT_ATTEMPT", "PRINT_ATTEMPT", "BLOCKED_SHORTCUT", "PAGE_REFRESH",
    )},
    **{event: _policy("camera", counts=True, automated=False, metadata=_HEALTH_FIELDS) for event in (
        "CAMERA_PERMISSION_DENIED", "CAMERA_NOT_AVAILABLE", "CAMERA_TRACK_MUTED", "CAMERA_TRACK_ENDED",
    )},
    **{event: _policy("microphone", counts=True, automated=False, metadata=_HEALTH_FIELDS) for event in (
        "MIC_PERMISSION_DENIED", "MIC_NOT_AVAILABLE", "MIC_TRACK_MUTED", "MIC_TRACK_ENDED",
    )},
    **{event: _policy("camera", counts=True, automated=True, metadata=_VISION_FIELDS, required=_AUTOMATED_REQUIRED) for event in (
        "NO_FACE_DETECTED", "FACE_QUALITY_LOW", "FACE_POSITION_INVALID", "UPPER_BODY_NOT_VISIBLE",
        "MULTIPLE_FACES_DETECTED", "PHONE_DETECTED",
    )},
    **{event: _policy("camera", counts=False, automated=True, metadata=_VISION_FIELDS, required=_AUTOMATED_REQUIRED) for event in (
        "GAZE_AWAY_SUSTAINED", "HEAD_POSE_OUT_OF_RANGE", "REPEATED_HEAD_MOVEMENT",
    )},
    **{event: _policy("microphone", counts=False, automated=True, metadata=_AUDIO_FIELDS, required=_AUTOMATED_REQUIRED) for event in (
        "AUDIO_ACTIVITY_DETECTED", "SPEECH_ACTIVITY_DETECTED", "AUDIO_SIGNAL_DEGRADED",
    )},
}

def normalize_event_type(event_type: str) -> str:
    normalized = event_type.strip().upper()
    if normalized not in EVENT_POLICY:
        raise ValueError("Unsupported or system-only anti-cheat event type")
    return normalized


def get_event_policy(event_type: str) -> EventPolicy | None:
    return EVENT_POLICY.get(event_type.strip().upper())


def classify_event(event_type: str) -> dict[str, bool]:
    policy = get_event_policy(event_type)
    return {
        "automatedFlag": bool(policy and policy.automated_flag),
        "countsTowardLimit": bool(policy and policy.counts_toward_limit),
    }


def validate_event_payload(event_type: str, source: str, metadata: dict[str, Any] | None) -> EventPolicy:
    policy = EVENT_POLICY[normalize_event_type(event_type)]
    if source not in policy.allowed_sources:
        raise ValueError("Anti-cheat event source does not match event type")
    _validate_metadata(metadata, policy)
    return policy


def _validate_metadata(metadata: dict[str, Any] | None, policy: EventPolicy) -> None:
    if metadata is None:
        if policy.required_metadata:
            raise ValueError("metadata is required for automated detector events")
        return
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object")
    unknown = set(metadata) - set(policy.metadata_schema)
    if unknown:
        raise ValueError("metadata contains unsupported or raw-media fields")
    missing = policy.required_metadata - set(metadata)
    if missing:
        raise ValueError("metadata is missing required detector fields")
    for key, value in metadata.items():
        field = policy.metadata_schema[key]
        if isinstance(value, bool) or not isinstance(value, field.kind):
            raise ValueError(f"metadata.{key} has an invalid type")
        if isinstance(value, str):
            if field.max_length is not None and len(value) > field.max_length:
                raise ValueError(f"metadata.{key} exceeds its maximum length")
            lowered = value.lower()
            if "base64," in lowered or lowered.startswith("data:") or lowered.startswith("blob:"):
                raise ValueError("metadata must not contain raw media payloads")
        else:
            numeric = float(value)
            if field.minimum is not None and numeric < field.minimum or field.maximum is not None and numeric > field.maximum:
                raise ValueError(f"metadata.{key} is outside its permitted range")
    encoded = json.dumps(metadata, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    if len(encoded) > MAX_METADATA_BYTES:
        raise ValueError("metadata must not exceed 4096 bytes")
