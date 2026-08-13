import { apiClient } from "./api-client";
import type {
  AddClassStudentsResult,
  AssignableTeacher,
  ClassDetail,
  AvailableStudent,
  ClassMutationResult,
  ClassPerson,
  ClassSummary,
} from "../types/admin-class";

export interface CreateClassInput {
  class_name: string;
  subject_id: string;
  teacher_school_id: string;
}

export const adminClassService = {
  async create(input: CreateClassInput): Promise<ClassMutationResult> {
    const { data } = await apiClient.post<ClassMutationResult>("/api/admin/classes", input);
    return data;
  },

  async rename(classId: number, className: string): Promise<ClassSummary> {
    const { data } = await apiClient.patch<ClassSummary>(`/api/admin/classes/${classId}`, {
      class_name: className,
    });
    return data;
  },

  async remove(classId: number): Promise<void> {
    await apiClient.delete(`/api/admin/classes/${classId}`);
  },

  async list(): Promise<ClassSummary[]> {
    const { data } = await apiClient.get<{ items: ClassSummary[] }>("/api/admin/classes");
    return data.items;
  },

  async detail(classId: number): Promise<ClassDetail> {
    const { data } = await apiClient.get<ClassDetail>(`/api/admin/classes/${classId}`);
    return data;
  },

  async availableStudents(classId: number): Promise<AvailableStudent[]> {
    const { data } = await apiClient.get<AvailableStudent[]>(`/api/admin/classes/${classId}/available-students`);
    return data;
  },

  async teachers(subjectId?: string): Promise<AssignableTeacher[]> {
    const { data } = await apiClient.get<AssignableTeacher[]>("/api/admin/classes/teachers", {
      params: subjectId ? { subject_id: subjectId } : undefined,
    });
    return data;
  },

  async changeTeacher(classId: number, teacherSchoolId: string): Promise<ClassMutationResult> {
    const { data } = await apiClient.patch<ClassMutationResult>(`/api/admin/classes/${classId}/teacher`, {
      teacher_school_id: teacherSchoolId,
    });
    return data;
  },

  async addStudents(classId: number, studentIds: string[]): Promise<AddClassStudentsResult> {
    const { data } = await apiClient.post<AddClassStudentsResult>(`/api/admin/classes/${classId}/students`, {
      student_ids: studentIds,
    });
    return data;
  },

  async removeStudent(classId: number, studentSchoolId: string): Promise<void> {
    await apiClient.delete(`/api/admin/classes/${classId}/students/${studentSchoolId}`);
  },
};
