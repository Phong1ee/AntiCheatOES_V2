"""Read-only Railway deployment health with a Project token."""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


_ENDPOINT = "https://backboard.railway.com/graphql/v2"
_TOKEN_QUERY = "query { projectToken { projectId environmentId } }"
_LOG = logging.getLogger(__name__)
_SERVICES_QUERY = """
query RailwayServices($projectId: String!, $environmentId: String!) {
  environment(id: $environmentId, projectId: $projectId) {
    serviceInstances { edges { node {
      serviceName
      latestDeployment { status createdAt meta deploymentStopped }
    } } }
  }
}
"""
_METRICS_QUERY = """
query RailwayMetrics(
  $environmentId: String!,
  $startDate: DateTime!,
  $sampleRateSeconds: Int,
  $averagingWindowSeconds: Int,
  $measurements: [MetricMeasurement!]!
) {
  metrics(
    environmentId: $environmentId,
    startDate: $startDate,
    sampleRateSeconds: $sampleRateSeconds,
    averagingWindowSeconds: $averagingWindowSeconds,
    measurements: $measurements
  ) {
    measurement
    values { ts value }
  }
}
"""
_METRIC_MEASUREMENTS = (
    "CPU_USAGE",
    "CPU_LIMIT",
    "MEMORY_USAGE_GB",
    "MEMORY_LIMIT_GB",
    "NETWORK_RX_GB",
    "NETWORK_TX_GB",
)


def _query(token: str, query: str, variables: dict | None = None) -> dict:
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    request = Request(
        _ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Project-Access-Token": token,
            "User-Agent": "AntiCheatOES-SystemHealth/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:  # nosec B310 - fixed HTTPS endpoint
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        # Read only Railway's public error message. Never emit the raw response,
        # which may contain request metadata that does not belong in application logs.
        try:
            error_payload = json.loads(exc.read().decode("utf-8"))
            messages = [str(item.get("message", "")) for item in error_payload.get("errors", []) if isinstance(item, dict)]
        except (UnicodeDecodeError, ValueError, OSError):
            messages = []
        detail = "; ".join(message for message in messages if message) or "no safe error message returned"
        raise RuntimeError(f"Railway API HTTP {exc.code}: {detail}") from exc
    if payload.get("errors"):
        # Railway GraphQL errors contain no credentials. Retain only messages so
        # an operator can diagnose a schema/scope issue from the platform log.
        messages = [str(item.get("message", "unknown error")) for item in payload["errors"] if isinstance(item, dict)]
        raise RuntimeError("Railway rejected the health query: " + "; ".join(messages[:3]))
    return payload.get("data") or {}


def _latest_metric_value(values: list[dict]) -> float | None:
    valid = []
    for item in values:
        try:
            valid.append((float(item["ts"]), float(item["value"])))
        except (KeyError, TypeError, ValueError):
            continue
    return max(valid, default=(0.0, None))[1]


def _network_delta_mb(values: list[dict]) -> float | None:
    valid = []
    for item in values:
        try:
            valid.append((float(item["ts"]), float(item["value"])))
        except (KeyError, TypeError, ValueError):
            continue
    if not valid:
        return None
    valid.sort()
    # Railway reports network counters in GB. A delta over the selected window
    # represents traffic during that period without exposing raw service metrics.
    total_gb = max(valid[-1][1] - valid[0][1], 0.0)
    return round(total_gb * 1024, 2)


def _railway_metrics(token: str, environment_id: str) -> dict:
    start_date = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    response = _query(token, _METRICS_QUERY, {
        "environmentId": environment_id,
        "startDate": start_date,
        "sampleRateSeconds": 60,
        "averagingWindowSeconds": 60,
        "measurements": list(_METRIC_MEASUREMENTS),
    })
    series = response.get("metrics") or []
    by_measurement = {
        str(item.get("measurement")): item.get("values") or []
        for item in series if isinstance(item, dict)
    }
    cpu_usage = _latest_metric_value(by_measurement.get("CPU_USAGE", []))
    cpu_limit = _latest_metric_value(by_measurement.get("CPU_LIMIT", []))
    memory_usage = _latest_metric_value(by_measurement.get("MEMORY_USAGE_GB", []))
    memory_limit = _latest_metric_value(by_measurement.get("MEMORY_LIMIT_GB", []))
    cpu_percent = round(cpu_usage / cpu_limit * 100, 1) if cpu_usage is not None and cpu_limit and cpu_limit > 0 else None
    memory_percent = round(memory_usage / memory_limit * 100, 1) if memory_usage is not None and memory_limit and memory_limit > 0 else None
    return {
        "status": "healthy" if any(value is not None for value in (cpu_percent, memory_percent, memory_usage)) else "unavailable",
        "cpu_percent": cpu_percent,
        "memory_used_gb": round(memory_usage, 3) if memory_usage is not None else None,
        "memory_limit_gb": round(memory_limit, 3) if memory_limit is not None else None,
        "memory_percent": memory_percent,
        "network_rx_mb": _network_delta_mb(by_measurement.get("NETWORK_RX_GB", [])),
        "network_tx_mb": _network_delta_mb(by_measurement.get("NETWORK_TX_GB", [])),
        "window_minutes": 5,
    }


def railway_health() -> dict:
    """Return only deploy facts safe for the Admin dashboard; fail closed on errors."""
    token = os.getenv("RAILWAY_TOKEN", "").strip()
    if not token:
        return {"status": "disabled", "services": [], "metrics": {"status": "disabled"}}
    try:
        scope = _query(token, _TOKEN_QUERY).get("projectToken") or {}
        project_id = scope.get("projectId")
        environment_id = scope.get("environmentId")
        if not isinstance(project_id, str) or not isinstance(environment_id, str):
            raise RuntimeError("Railway token scope is unavailable")
        environment = _query(token, _SERVICES_QUERY, {"projectId": project_id, "environmentId": environment_id}).get("environment") or {}
        services = []
        for edge in ((environment.get("serviceInstances") or {}).get("edges") or []):
            instance = edge.get("node") or {}
            deployment = instance.get("latestDeployment") or {}
            status = str(deployment.get("status") or "UNAVAILABLE").lower()
            services.append({
                "name": str(instance.get("serviceName") or "service"),
                "status": "healthy" if status == "success" else ("degraded" if status in {"building", "deploying", "waiting"} else "unavailable"),
                "deployment_status": status,
                "deployed_at": deployment.get("createdAt"),
                "commit": (deployment.get("meta") or {}).get("commitHash"),
            })
        try:
            metrics = _railway_metrics(token, environment_id)
        except (URLError, OSError, ValueError, RuntimeError, KeyError, TypeError) as exc:
            _LOG.warning("Railway resource metrics unavailable: %s", exc)
            metrics = {"status": "unavailable"}
        return {"status": "healthy", "services": services, "metrics": metrics}
    except (URLError, OSError, ValueError, RuntimeError, KeyError, TypeError) as exc:
        # Never log the token, GraphQL variables, service IDs, or response body.
        _LOG.warning("Railway deployment telemetry unavailable: %s", exc)
        return {"status": "unavailable", "services": [], "metrics": {"status": "unavailable"}}
