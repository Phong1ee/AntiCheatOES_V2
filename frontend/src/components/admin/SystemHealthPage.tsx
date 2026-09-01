import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Database, FileText, Server, Users } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { adminSystemHealthService, type HealthStatus, type SystemHealth } from "../../services/admin-system-health.service";

const statusClass: Record<HealthStatus, string> = {
  healthy: "bg-green-100 text-green-700 border-green-300",
  degraded: "bg-amber-100 text-amber-700 border-amber-300",
  unavailable: "bg-red-100 text-red-700 border-red-300",
  offline: "bg-gray-100 text-gray-700 border-gray-300",
};

function displayMetric(value: number | null): string {
  return value === null ? "Unavailable" : String(value);
}

export function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await adminSystemHealthService.get();
        if (active) {
          setHealth(response);
          setError(null);
        }
      } catch {
        if (active) setError("Unable to load system health. Please try again.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const statistics = health ? [
    { label: "Total Users", value: health.statistics.total_users, icon: Users },
    { label: "Active Exams", value: health.statistics.active_exams, icon: FileText },
    { label: "Students in Progress", value: health.statistics.students_in_progress, icon: Activity },
    { label: "API Calls / min", value: displayMetric(health.statistics.api_requests_per_minute), icon: Server },
  ] : [];

  return <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl text-gray-900">System Health Monitoring</h1>
          <p className="mt-1 text-gray-600">Application dependencies and live examination activity. Refreshes every 30 seconds.</p>
        </div>
        {health && <Badge className={statusClass[health.status]}>{health.status}</Badge>}
      </div>

      {error && <Card className="mb-6 border-red-200 bg-red-50 p-4 text-red-800">{error}</Card>}
      {!health && !error && <Card className="p-6 text-gray-600">Loading real system health...</Card>}

      {health && <>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statistics.map(({ label, value, icon: Icon }) => <Card key={label} className="border border-gray-200 bg-white p-4 shadow-sm">
            <Icon className="mb-2 size-5 text-teal-600" />
            <div className="text-2xl text-gray-900">{value}</div>
            <div className="text-sm text-gray-600">{label}</div>
          </Card>)}
        </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border border-gray-200 bg-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-xl text-gray-900"><Server className="size-5 text-teal-600" />Services</h2>
            <div className="space-y-3">{health.services.map((service) => <div key={service.name} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
              <span className="text-sm text-gray-900">{service.name}</span><Badge className={statusClass[service.status]}>{service.status}</Badge>
            </div>)}</div>
          </Card>
          <Card className="border border-gray-200 bg-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-xl text-gray-900"><AlertCircle className="size-5 text-orange-600" />Railway Deployments</h2>
            {health.railway.status === "disabled" && <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">Railway deployment telemetry is disabled.</div>}
            {health.railway.status === "unavailable" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Railway deployment telemetry is currently unavailable.</div>}
            {health.railway.services.map((service) => <div key={service.name} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"><div className="flex items-center justify-between"><span className="text-gray-900">{service.name}</span><Badge className={statusClass[service.status]}>{service.deployment_status}</Badge></div>{service.commit && <div className="mt-1 text-xs text-gray-500">Commit {service.commit.slice(0, 7)}</div>}</div>)}
          </Card>
          <Card className="border border-gray-200 bg-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-xl text-gray-900"><AlertCircle className="size-5 text-orange-600" />Current Alerts</h2>
            {health.alerts.length === 0 ? <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800"><CheckCircle2 className="size-5" />No active application alerts.</div> :
              <div className="space-y-3">{health.alerts.map((alert, index) => <div key={`${alert.message}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{alert.message}</div>)}</div>}
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500"><Database className="size-4" />Checked {new Date(health.checked_at).toLocaleString()}</div>
          </Card>
        </div>
      </>}
    </main>
  </div>;
}
