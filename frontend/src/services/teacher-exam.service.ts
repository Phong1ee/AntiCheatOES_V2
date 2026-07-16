import { apiClient } from "./api-client";
import type { TeacherExamApi, TeacherExamRequest, TeacherSubject } from "../types/teacher-exam";

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

  async delete(examId: number): Promise<void> {
    await apiClient.delete(`/api/teacher/delete_exam/${examId}`);
  },
};
