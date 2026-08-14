import { apiClient } from "./api-client";
import type {
  AssignmentOptions,
  AssignmentSyncResult,
  ExamStatus,
  ResultVisibility,
  TeacherExamApi,
  TeacherExamRequest,
  TeacherResultVisibilityRequest,
  TeacherResultVisibilityResponse,
  TeacherSubject,
} from "../types/teacher-exam";

interface TeacherOverview {
  subjects: TeacherSubject[];
}

export const teacherExamService = {
  async list(): Promise<TeacherExamApi[]> {
    const { data } = await apiClient.get<TeacherExamApi[]>("/api/teacher/exams");
    return data;
  },

  async listSubjects(): Promise<TeacherSubject[]> {
    const { data } = await apiClient.get<TeacherOverview>("/api/teacher/get_exam_overview/");
    return data.subjects ?? [];
  },

  async create(payload: TeacherExamRequest): Promise<TeacherExamApi> {
    const { data } = await apiClient.post<TeacherExamApi>("/api/teacher/add_exam", payload);
    return data;
  },

  async update(examId: number, payload: TeacherExamRequest): Promise<TeacherExamApi> {
    const { data } = await apiClient.put<TeacherExamApi>(`/api/teacher/update_exam/${examId}`, payload);
    return data;
  },

  async duplicate(examId: number): Promise<TeacherExamApi> {
    const { data } = await apiClient.post<TeacherExamApi>(`/api/teacher/exams/${examId}/duplicate`);
    return data;
  },

  async updateStatus(examId: number, status: ExamStatus, expectedVersion?: number): Promise<TeacherExamApi> {
    const { data } = await apiClient.patch<TeacherExamApi>(`/api/teacher/exams/${examId}/status`, {
      status,
      expected_version: expectedVersion,
    });
    return data;
  },

  async updateResultVisibility(
    examId: number,
    resultVisibility: ResultVisibility,
    expectedVersion?: number,
  ): Promise<TeacherResultVisibilityResponse> {
    const payload: TeacherResultVisibilityRequest = {
      result_visibility: resultVisibility,
      expected_version: expectedVersion,
    };
    const { data } = await apiClient.patch<TeacherResultVisibilityResponse>(
      `/api/teacher/exams/${examId}/result-visibility`,
      payload,
    );
    return data;
  },


  async delete(examId: number, expectedVersion?: number): Promise<void> {
    await apiClient.delete(`/api/teacher/delete_exam/${examId}`, { params: { expected_version: expectedVersion } });
  },

  async getAssignmentOptions(examId: number): Promise<AssignmentOptions> {
    const { data } = await apiClient.get<AssignmentOptions>(
      `/api/teacher/exams/${examId}/assignment-options`,
    );
    return data;
  },

  async saveAssignments(examId: number, studentIds: string[], expectedVersion?: number): Promise<AssignmentSyncResult> {
    const { data } = await apiClient.put<AssignmentSyncResult>(
      `/api/teacher/exams/${examId}/assignments`,
      { class_ids: [], student_ids: studentIds, excluded_student_ids: [], expected_version: expectedVersion },
    );
    return data;
  },
};
