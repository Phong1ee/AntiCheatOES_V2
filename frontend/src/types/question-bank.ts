export type QuestionBankTab = "bank" | "mine";
export type QuestionStatus = "draft" | "pending" | "approved" | "rejected";
export type QuestionType = "MCQ" | "essay" | "true-false";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface SubjectSummary {
  subject_id: string;
  subject_name: string;
}

export interface ChapterSummary {
  chapter_id: number;
  chapter_name: string;
}

export interface LearningObjectiveSummary {
  lo_id: number;
  lo_name: string;
}

export interface QuestionOptionSummary {
  options_id?: number;
  options_text: string;
  is_correct: boolean;
}

export interface PermissionFlags {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_resubmit: boolean;
}

export interface QuestionBankItem {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  question_difficulties: QuestionDifficulty | null;
  question_status: QuestionStatus;
  subject: SubjectSummary | null;
  chapters: ChapterSummary[];
  learning_objectives: LearningObjectiveSummary[];
  option_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
  usage_count?: number;
  permissions: PermissionFlags;
}

export interface QuestionDetail extends QuestionBankItem {
  created_by?: number | null;
  creator?: {
    id: number;
    school_id: string;
    full_name: string;
  } | null;
  options: QuestionOptionSummary[];
  rejected_feedback?: string | null;
}

export interface QuestionListResponse {
  items: QuestionBankItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface SubjectCount {
  subject_id: string;
  subject_name: string;
  subject_description?: string;
  question_count: number;
}

export interface SubjectCountResponse {
  scope: QuestionBankTab;
  total_count: number;
  no_subject_count: number;
  subjects: SubjectCount[];
}

export interface QuestionBankFilters {
  status?: QuestionStatus;
  question_type?: QuestionType;
  difficulty?: QuestionDifficulty;
  chapter_id?: number;
  lo_id?: number;
}

export interface QuestionBankListParams extends QuestionBankFilters {
  subject_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface QuestionOptionPayload {
  options_id?: number;
  options_text: string;
  is_correct: boolean;
}

export interface QuestionPayload {
  question_text: string;
  question_type: QuestionType;
  question_difficulties?: QuestionDifficulty | null;
  subject_id?: string | null;
  chapter_ids: number[];
  lo_ids: number[];
  options: QuestionOptionPayload[];
}
