import { apiClient } from "./api-client";
import type { PermissionSubject, PermissionTeacher, TeacherPermissionAssignment } from "../types/teacher-permission";

export const teacherPermissionService = {
  async list(search?: string) {
    const { data } = await apiClient.get<{ items: TeacherPermissionAssignment[] }>("/api/admin/teacher-permissions", { params: { search: search || undefined } });
    return data.items;
  },
  async teachers() { const { data } = await apiClient.get<PermissionTeacher[]>("/api/admin/teacher-permissions/teachers"); return data; },
  async subjects() { const { data } = await apiClient.get<PermissionSubject[]>("/api/admin/teacher-permissions/subjects"); return data; },
  async grant(teacher_id: number, subject_id: string) { const { data } = await apiClient.post<TeacherPermissionAssignment>("/api/admin/teacher-permissions", { teacher_id, subject_id }); return data; },
  async revoke(teacher_id: number, subject_id: string) { const { data } = await apiClient.delete<TeacherPermissionAssignment>(`/api/admin/teacher-permissions/${teacher_id}/${subject_id}`); return data; },
  async updateTeacherPermissions(teacherId: number, subjectIds: string[]) {
    const { data } = await apiClient.patch(`/api/admin/teachers/${teacherId}/permissions`, { subject_ids: subjectIds });
    return data;
  },
  async removeAllAccess(teacherId: number) { return this.updateTeacherPermissions(teacherId, []); },
};
