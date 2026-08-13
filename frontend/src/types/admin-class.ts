export type AccountStatus = "active" | "inactive";

export interface ClassPerson {
  school_id: string;
  full_name: string;
  email: string;
  status: AccountStatus;
}

export interface ClassSummary {
  class_id: number;
  class_name: string;
  subject_id: string;
  subject_name: string | null;
  teacher: ClassPerson | null;
  student_count: number;
}

export interface ClassMutationResult extends ClassSummary {
  /** True when assigning the teacher also created/reactivated their subject access. */
  granted_subject_permission: boolean;
}

export interface ClassDetail extends ClassSummary {
  /** Whether the class teacher also holds active teacher_subject access. */
  teacher_has_subject_permission: boolean;
  students: ClassPerson[];
}

export interface AvailableStudent extends ClassPerson {
  /** Set when the student already attends another class of the same subject. */
  conflict_class_name: string | null;
}

export interface AssignableTeacher extends ClassPerson {
  /** Null when the caller did not scope the request to a subject. */
  has_subject_permission: boolean | null;
}

export interface AddClassStudentsResult {
  added_count: number;
  skipped_count: number;
  student_ids: string[];
}
