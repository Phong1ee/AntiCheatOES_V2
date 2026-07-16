export interface TeacherSubject {
  subject_id: string;
  subject_name: string;
  subject_description: string;
  question_count: number;
}

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
  status: "upcoming" | "ongoing" | "completed";
  subject: string | null;
  subject_id: string | null;
  result_visibility: "hidden" | "score-only" | "full" | null;
}

export interface TeacherExamRequest {
  title: string;
  examcode: string;
  max_attempt: number;
  description: string;
  duration_minutes: number;
  result_visibility: "hidden" | "score-only" | "full";
  subject_id: string;
}
