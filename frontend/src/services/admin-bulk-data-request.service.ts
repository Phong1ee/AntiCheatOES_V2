import { apiClient } from "./api-client";
import type { AdminQuestionImportPreview } from "./admin-question-bank.service";
import type { AdminUserImportPreviewResponse } from "../types/admin-user";

export type AdminBulkRequestType = "QUESTION_BANK" | "USER_IMPORT";
export type AdminBulkRequestStatus = "PENDING" | "PROCESSING" | "IMPORTED" | "REJECTED" | "FAILED";

export interface AdminBulkDataRequest {
  request_id: number;
  request_type: AdminBulkRequestType;
  status: AdminBulkRequestStatus;
  requested_by: string;
  subject: { subject_id: string; subject_name: string } | null;
  original_filename: string;
  file_size: number;
  teacher_note: string | null;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  result_metadata: Record<string, unknown> | null;
}

export interface AdminBulkDataRequestList {
  items: AdminBulkDataRequest[];
  page: number;
  page_size: number;
  total: number;
}

export interface AdminImportJobResult {
  jobId: number;
  jobType: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  result: Record<string, unknown>;
  error: string | null;
}

type AdminBulkUserPreview = Omit<AdminUserImportPreviewResponse, "file_name">;

export type AdminBulkImportResult =
  | { request: AdminBulkDataRequest; background: false }
  | { request: AdminBulkDataRequest; background: true; job: AdminImportJobResult };

export type AdminBulkPreview =
  | { request: AdminBulkDataRequest; preview: AdminQuestionImportPreview }
  | { request: AdminBulkDataRequest; preview: AdminBulkUserPreview };

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export const adminBulkDataRequestService = {
  async list(page = 1, pageSize = 50): Promise<AdminBulkDataRequestList> {
    const { data } = await apiClient.get<AdminBulkDataRequestList>("/api/admin/bulk-data-requests", { params: { page, page_size: pageSize } });
    return data;
  },

  async get(requestId: number): Promise<AdminBulkDataRequest> {
    const { data } = await apiClient.get<AdminBulkDataRequest>(`/api/admin/bulk-data-requests/${requestId}`);
    return data;
  },

  async download(request: Pick<AdminBulkDataRequest, "request_id" | "original_filename">): Promise<void> {
    const { data } = await apiClient.get(`/api/admin/bulk-data-requests/${request.request_id}/download`, { responseType: "blob" });
    triggerDownload(data as Blob, request.original_filename);
  },

  async preview(requestId: number): Promise<AdminBulkPreview> {
    const { data } = await apiClient.post<AdminBulkPreview>(`/api/admin/bulk-data-requests/${requestId}/preview`);
    return data;
  },

  async reject(requestId: number, reason: string): Promise<AdminBulkDataRequest> {
    const { data } = await apiClient.post<AdminBulkDataRequest>(`/api/admin/bulk-data-requests/${requestId}/reject`, { reason });
    return data;
  },

  async importRequest(requestId: number): Promise<AdminBulkImportResult> {
    const { data } = await apiClient.post<AdminBulkImportResult>(`/api/admin/bulk-data-requests/${requestId}/import`);
    return data;
  },

  async getImportJob(jobId: number): Promise<AdminImportJobResult> {
    const { data } = await apiClient.get<AdminImportJobResult>(`/api/admin/import-jobs/${jobId}`);
    return data;
  },
};
