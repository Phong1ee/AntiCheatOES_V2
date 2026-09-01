"""Read-only Railway deployment health with a Project token."""

import json
import logging
import os
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


def railway_health() -> dict:
    """Return only deploy facts safe for the Admin dashboard; fail closed on errors."""
    token = os.getenv("RAILWAY_TOKEN", "").strip()
    if not token:
        return {"status": "disabled", "services": []}
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
        return {"status": "healthy", "services": services}
    except (URLError, OSError, ValueError, RuntimeError, KeyError, TypeError) as exc:
        # Never log the token, GraphQL variables, service IDs, or response body.
        _LOG.warning("Railway deployment telemetry unavailable: %s", exc)
        return {"status": "unavailable", "services": []}
