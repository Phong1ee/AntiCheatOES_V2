import { apiClient } from "./api-client";
import type { StudentExamResult } from "../types/student-result";

interface StudentResultsResponse {
  success: boolean;
  results: StudentExamResult[];
}

interface StudentResultDetailResponse {
  success: boolean;
  result: StudentExamResult;
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
};
