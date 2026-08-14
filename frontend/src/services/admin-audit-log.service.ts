import { apiClient } from "./api-client";
import type { AdminAuditAction, AdminAuditListParams, AdminAuditLogDetail, AdminAuditLogList, AdminAuditStats } from "../types/admin-audit-log";

export const adminAuditLogService = {
  async list(params: AdminAuditListParams = {}): Promise<AdminAuditLogList> { const { data } = await apiClient.get("/api/admin/audit-logs", { params: { page: 1, page_size: 25, ...params } }); return data; },
  async get(auditLogId: number): Promise<AdminAuditLogDetail> { const { data } = await apiClient.get(`/api/admin/audit-logs/${auditLogId}`); return data; },
  async getStats(): Promise<AdminAuditStats> { const { data } = await apiClient.get("/api/admin/audit-logs/stats"); return data; },
  async getActions(): Promise<{ actions: AdminAuditAction[]; categories: string[] }> { const { data } = await apiClient.get("/api/admin/audit-logs/actions"); return data; },
  async exportCsv(params: AdminAuditListParams = {}): Promise<Blob> { const { data } = await apiClient.get("/api/admin/audit-logs/export", { params, responseType: "blob" }); return data; },
};
