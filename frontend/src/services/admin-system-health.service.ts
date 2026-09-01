import { apiClient } from "./api-client";

export type HealthStatus = "healthy" | "degraded" | "unavailable" | "offline";

export interface SystemHealth {
  status: HealthStatus;
  checked_at: string;
  statistics: {
    total_users: number;
    active_exams: number;
    students_in_progress: number;
    api_requests_per_minute: number | null;
    api_average_latency_ms: number | null;
  };
  services: Array<{ name: string; status: HealthStatus }>;
  alerts: Array<{ severity: "warning" | "error"; message: string }>;
}

export const adminSystemHealthService = {
  async get(): Promise<SystemHealth> {
    const { data } = await apiClient.get<SystemHealth>("/api/admin/system-health");
    return data;
  },
};
