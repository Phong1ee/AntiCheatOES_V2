import { apiClient } from "./api-client";
import type {
  EssayGradingItem,
  ExamResultSummary,
  ExamResultsOverview,
  GradeEssayResult,
  QuestionStat,
  ResultStrategy,
  StudentAttemptDetail,
  StudentResult,
} from "../types/teacher-results";

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export const teacherResultsService = {
  async listExams(): Promise<ExamResultSummary[]> {
    const { data } = await apiClient.get<ExamResultSummary[]>("/api/teacher/results/exams");
    return data;
  },

  async getOverview(examId: number): Promise<ExamResultsOverview> {
    const { data } = await apiClient.get<ExamResultsOverview>(`/api/teacher/results/exams/${examId}/overview`);
    return data;
  },

  async listStudents(examId: number): Promise<StudentResult[]> {
    const { data } = await apiClient.get<StudentResult[]>(`/api/teacher/results/exams/${examId}/students`);
    return data;
  },

  async getAttemptDetail(examId: number, attemptId: number): Promise<StudentAttemptDetail> {
    const { data } = await apiClient.get<StudentAttemptDetail>(
      `/api/teacher/results/exams/${examId}/students/${attemptId}`,
    );
    return data;
  },

  async getStatistics(examId: number): Promise<QuestionStat[]> {
    const { data } = await apiClient.get<QuestionStat[]>(`/api/teacher/results/exams/${examId}/statistics`);
    return data;
  },

  async listEssays(examId: number): Promise<EssayGradingItem[]> {
    const { data } = await apiClient.get<EssayGradingItem[]>(`/api/teacher/results/exams/${examId}/essays`);
    return data;
  },

  async gradeEssay(examId: number, essayAnswerId: number, score: number): Promise<GradeEssayResult> {
    const { data } = await apiClient.put<GradeEssayResult>(
      `/api/teacher/results/exams/${examId}/essays/${essayAnswerId}`,
      { score },
    );
    return data;
  },

  async updateStrategy(examId: number, strategy: ResultStrategy): Promise<{ resultStrategy: ResultStrategy }> {
    const { data } = await apiClient.put<{ resultStrategy: ResultStrategy }>(
      `/api/teacher/results/exams/${examId}/strategy`,
      { strategy },
    );
    return data;
  },

  async requestExcelExport(examId: number): Promise<{ jobId: number }> {
    const requestId = crypto.randomUUID();
    const { data } = await apiClient.post<{ jobId: number }>(`/api/teacher/results/exams/${examId}/report-jobs`, {
      requestId,
    });
    return data;
  },

  async getExcelExportJob(jobId: number): Promise<{ status: string; error?: string | null }> {
    const { data } = await apiClient.get<{ status: string; error?: string | null }>(
      `/api/teacher/results/report-jobs/${jobId}`,
    );
    return data;
  },

  async downloadExcelExport(jobId: number, examName: string): Promise<void> {
    const { data } = await apiClient.get(`/api/teacher/results/report-jobs/${jobId}/download`, {
      responseType: "blob",
    });
    const safeName = examName.replace(/[^a-z0-9_-]+/gi, "_");
    triggerDownload(data as Blob, `${safeName}_results.xlsx`);
  },
};

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv" }), filename);
}
