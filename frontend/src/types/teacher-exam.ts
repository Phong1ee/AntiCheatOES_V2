export interface TeacherSubject {
  subject_id: string;
  subject_name: string;
  subject_description: string;
  question_count: number;
}

export type ExamStatus = "draft" | "published";
export type ResultVisibility = "hidden" | "score-only" | "full";

export interface TeacherExamApi {
  exam_id: number;
  title: string;
  examcode: string;
  description: string | null;
  max_attempt: number | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  totalStudents: number;
  manage_by: string;
  status: ExamStatus;
  schedule_status: "upcoming" | "ongoing" | "completed";
  subject: string | null;
  subject_id: string | null;
  result_visibility: ResultVisibility | null;
  total_points: number;
  passing_score: number;
  question_selection_mode: "manual" | "fixed_randomization" | "pool";
}

export interface TeacherExamRequest {
  title: string;
  examcode: string;
  max_attempt: number;
  description: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  status: ExamStatus;
  result_visibility: ResultVisibility;
  subject_id: string;
  total_points: number;
  passing_score: number;
}

export interface TeacherResultVisibilityRequest {
  result_visibility: ResultVisibility;
}

export interface TeacherResultVisibilityResponse {
  exam_id: number;
  result_visibility: ResultVisibility;
}

export interface AssignmentClass {
  class_id: number;
  class_name: string;
  subject_id: string;
  student_count: number;
}

export interface AssignmentStudent {
  school_id: string;
  full_name: string;
  email: string;
  class_ids: number[];
  class_names: string[];
  assigned: boolean;
}

export interface AssignmentOptions {
  classes: AssignmentClass[];
  students: AssignmentStudent[];
  assigned_count: number;
}

export interface AssignmentSyncResult {
  added_count: number;
  removed_count: number;
  unchanged_count: number;
  final_count: number;
  student_ids: string[];
}
