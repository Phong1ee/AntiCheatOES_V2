export interface TeacherPermissionAssignment {
  teacher_school_id: string;
  teacher_full_name: string;
  teacher_email: string;
  subject_id: string;
  subject_name: string;
  assigned_by: string | null;
  assigned_at: string | null;
  is_active: boolean;
}

export interface PermissionTeacher { school_id: string; full_name: string; email: string; }
export interface PermissionSubject { subject_id: string; subject_name: string; }
