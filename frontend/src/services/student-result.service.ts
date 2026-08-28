import { apiClient } from "./api-client";
import type { StudentExamResult, StudentViolationEvent } from "../types/student-result";

interface StudentResultsResponse {
  success: boolean;
  results: StudentExamResult[];
}

interface StudentResultDetailResponse {
  success: boolean;
  result: StudentExamResult;
}

interface StudentViolationEventsResponse {
  success: boolean;
  violations: StudentViolationEvent[];
}

export const studentResultService = {
  async list(): Promise<StudentExamResult[]> {
    const { data } = await apiClient.get<StudentResultsResponse>("/api/results");
    return data.results;
  },

  async getDetail(attemptId: number): Promise<StudentExamResult> {
    const { data } = await apiClient.get<StudentResultDetailResponse>(`/api/results/${attemptId}`);
    return data.result;
  },

  async getViolationEvents(attemptId: number): Promise<StudentViolationEvent[]> {
    const { data } = await apiClient.get<StudentViolationEventsResponse>(`/api/results/${attemptId}/violations`);
    return data.violations;
  },
};
