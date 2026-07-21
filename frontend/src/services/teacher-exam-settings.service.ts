import { apiClient } from "./api-client";
import type {
  TeacherExamSettingsApi,
  TeacherExamSettingsPayload,
} from "../types/examSettings";

export const teacherExamSettingsService = {
  async get(examId: number): Promise<TeacherExamSettingsApi> {
    const { data } = await apiClient.get<TeacherExamSettingsApi>(
      `/api/teacher/exams/${examId}/settings`,
    );
    return data;
  },

  async create(examId: number, payload: TeacherExamSettingsPayload): Promise<TeacherExamSettingsApi> {
    const { data } = await apiClient.post<TeacherExamSettingsApi>(
      `/api/teacher/exams/${examId}/settings`,
      payload,
    );
    return data;
  },

  async update(examId: number, payload: TeacherExamSettingsPayload): Promise<TeacherExamSettingsApi> {
    const { data } = await apiClient.put<TeacherExamSettingsApi>(
      `/api/teacher/exams/${examId}/settings`,
      payload,
    );
    return data;
  },

  async remove(examId: number): Promise<void> {
    await apiClient.delete(`/api/teacher/exams/${examId}/settings`);
  },
};
