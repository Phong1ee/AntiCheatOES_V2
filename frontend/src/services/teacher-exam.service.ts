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

  async create(payload: TeacherExamRequest): Promise<void> {
    await apiClient.post("/api/teacher/add_exam", payload);
  },

  async update(examId: number, payload: TeacherExamRequest): Promise<void> {
    await apiClient.put(`/api/teacher/update_exam/${examId}`, payload);
  },
};
