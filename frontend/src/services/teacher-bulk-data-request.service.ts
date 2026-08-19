import { apiClient } from "./api-client";

export type BulkDataRequestType = "QUESTION_BANK" | "USER_IMPORT";
export type BulkDataRequestStatus = "PENDING" | "PROCESSING" | "IMPORTED" | "REJECTED" | "FAILED";

export interface TeacherBulkDataRequest {
  request_id: number;
  request_type: BulkDataRequestType;
  status: BulkDataRequestStatus;
  subject: { subject_id: string; subject_name: string } | null;
  original_filename: string;
  file_size: number;
  teacher_note: string | null;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  processed_at: string | null;
  result_metadata: Record<string, string | number | boolean | null> | null;
}

export interface TeacherBulkDataRequestList {
  items: TeacherBulkDataRequest[];
  page: number;
  page_size: number;
  total: number;
}

export interface CreateBulkDataRequestPayload {
  requestType: BulkDataRequestType;
  subjectId?: string;
  teacherNote?: string;
  file: File;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export const teacherBulkDataRequestService = {
  async createRequest(payload: CreateBulkDataRequestPayload): Promise<TeacherBulkDataRequest> {
    const formData = new FormData();
    formData.append("request_type", payload.requestType);
    if (payload.subjectId) formData.append("subject_id", payload.subjectId);
    if (payload.teacherNote) formData.append("teacher_note", payload.teacherNote);
    formData.append("file", payload.file);
    const { data } = await apiClient.post<TeacherBulkDataRequest>(
      "/api/teacher/bulk-data-requests",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async listMyRequests(page = 1, pageSize = 10): Promise<TeacherBulkDataRequestList> {
    const { data } = await apiClient.get<TeacherBulkDataRequestList>("/api/teacher/bulk-data-requests", {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  async getRequest(requestId: number): Promise<TeacherBulkDataRequest> {
    const { data } = await apiClient.get<TeacherBulkDataRequest>(`/api/teacher/bulk-data-requests/${requestId}`);
    return data;
  },

  /** The import template with the Subject block pre-filled for one assigned subject. */
  async downloadQuestionTemplate(subjectId: string): Promise<void> {
    const { data } = await apiClient.get("/api/teacher/bulk-data-requests/question-bank-template", {
      params: { subject_id: subjectId },
      responseType: "blob",
    });
    triggerDownload(data as Blob, `question-bank-${subjectId}.docx`);
  },

  /** The subject's existing chapters and learning objectives, to copy names from. */
  async downloadQuestionGuideline(subjectId: string): Promise<void> {
    const { data } = await apiClient.get("/api/teacher/bulk-data-requests/question-bank-guideline", {
      params: { subject_id: subjectId },
      responseType: "blob",
    });
    triggerDownload(data as Blob, `question-bank-${subjectId}-guideline.docx`);
  },

  async downloadRequest(request: Pick<TeacherBulkDataRequest, "request_id" | "original_filename">): Promise<void> {
    const { data } = await apiClient.get(`/api/teacher/bulk-data-requests/${request.request_id}/download`, {
      responseType: "blob",
    });
    triggerDownload(data as Blob, request.original_filename);
  },
};
