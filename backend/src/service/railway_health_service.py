"""Read-only Railway deployment health with a Project token."""

import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen


_ENDPOINT = "https://backboard.railway.app/graphql/v2"
_TOKEN_QUERY = "query { projectToken { projectId environmentId } }"
_SERVICES_QUERY = """
query RailwayServices($projectId: String!, $environmentId: String!) {
  project(id: $projectId) {
    services { edges { node {
      name
      serviceInstances { edges { node {
        latestDeployment { status createdAt meta deploymentStopped }
      } } }
    } } }
  }
}
"""


def _query(token: str, query: str, variables: dict | None = None) -> dict:
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    request = Request(
        _ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json", "Project-Access-Token": token},
        method="POST",
    )
    with urlopen(request, timeout=5) as response:  # nosec B310 - fixed HTTPS endpoint
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("errors"):
        raise RuntimeError("Railway rejected the health query")
    return payload.get("data") or {}


def railway_health() -> dict:
    """Return only deploy facts safe for the Admin dashboard; fail closed on errors."""
    token = os.getenv("RAILWAY_PROJECT_TOKEN", "").strip()
    if not token:
        return {"status": "disabled", "services": []}
    try:
        scope = _query(token, _TOKEN_QUERY).get("projectToken") or {}
        project_id = scope.get("projectId")
        environment_id = scope.get("environmentId")
        if not isinstance(project_id, str) or not isinstance(environment_id, str):
            raise RuntimeError("Railway token scope is unavailable")
        project = _query(token, _SERVICES_QUERY, {"projectId": project_id, "environmentId": environment_id}).get("project") or {}
        services = []
        for edge in ((project.get("services") or {}).get("edges") or []):
            service = edge.get("node") or {}
            instance_edges = ((service.get("serviceInstances") or {}).get("edges") or [])
            deployment = ((instance_edges[0].get("node") or {}).get("latestDeployment") or {}) if instance_edges else {}
            status = str(deployment.get("status") or "UNAVAILABLE").lower()
            services.append({
                "name": str(service.get("name") or "service"),
                "status": "healthy" if status == "success" else ("degraded" if status in {"building", "deploying", "waiting"} else "unavailable"),
                "deployment_status": status,
                "deployed_at": deployment.get("createdAt"),
                "commit": (deployment.get("meta") or {}).get("commitHash"),
            })
        return {"status": "healthy", "services": services}
    except (URLError, OSError, ValueError, RuntimeError, KeyError, TypeError):
        return {"status": "unavailable", "services": []}
