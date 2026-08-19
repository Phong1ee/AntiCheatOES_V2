import { apiClient } from "./api-client";
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  SubjectSummary,
} from "../types/question-bank";

export type { QuestionDifficulty, QuestionType } from "../types/question-bank";

export interface QuestionOptionRequest {
  options_id?: number;
  options_text: string;
  is_correct: boolean;
}

export interface CreateQuestionRequest {
  question_text: string;
  question_difficulties: QuestionDifficulty;
  question_type: QuestionType;
  subject_id: string;
  chapter_ids?: number[];
  lo_ids?: number[];
  question_status: "draft" | "pending" | "approved" | "rejected";
  options: QuestionOptionRequest[];
  exam_id: number;
  max_score: number;
}

export interface UpdateQuestionRequest {
  max_score: number;
  question_text?: string;
  question_difficulties?: QuestionDifficulty;
  question_type?: QuestionType;
  subject_id?: string;
  chapter_ids?: number[];
  lo_ids?: number[];
  question_status?: "draft" | "pending" | "approved" | "rejected";
  options?: QuestionOptionRequest[];
}

export interface ExamQuestionDetail {
  question_id: number;
  question_text: string;
  question_difficulties: QuestionDifficulty | null;
  question_type: QuestionType;
  subject_id: string | null;
  chapter_ids: number[];
  lo_ids: number[];
  question_status: "draft" | "pending" | "approved" | "rejected";
  question_point: number;
  max_score: number;
  can_edit_content: boolean;
  can_edit_points: boolean;
  source_question_id: number | null;
  question_bank_target_id: number;
  question_bank_target_tab: "bank" | "mine";
  chapters: ChapterSummary[];
  learning_objectives: LearningObjectiveSummary[];
  options: Array<{ options_id: number; options_text: string; is_correct: boolean }>;
}

export interface QuestionImportCandidate {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  question_difficulties: QuestionDifficulty | null;
  question_status: QuestionStatus;
  subject: SubjectSummary | null;
  chapters: ChapterSummary[];
  learning_objectives: LearningObjectiveSummary[];
  option_count: number;
  already_added: boolean;
  creator: { school_id: string; full_name: string } | null;
}

export interface QuestionImportCandidateParams {
  search?: string;
  question_type?: QuestionType;
  difficulty?: QuestionDifficulty;
  subject_id?: string;
  status?: QuestionStatus;
  created_by?: string;
  page?: number;
  page_size?: 10 | 20;
}

export interface QuestionImportCandidateResponse {
  items: QuestionImportCandidate[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  filter_options: {
    subjects: SubjectSummary[];
    creators: Array<{ school_id: string; full_name: string }>;
    statuses: QuestionStatus[];
    current_teacher_school_id: string;
  };
}

export interface ImportQuestionsResponse {
  success: boolean;
  /** The exam version this import claimed; the next write must send it. */
  version: number;
  imported_count: number;
  imported_question_ids: number[];
  automatically_distributed: boolean;
  default_max_score_applied: boolean;
  grading_scale: number;
  points: Array<{ question_id: number; question_point: string; max_score: string }>;
}

export interface QuestionUpdateResponse {
  success: boolean;
  question_id: number;
  cloned: boolean;
  source_question_id?: number | null;
}

export interface PoolAvailabilityRow {
  subject_id: string;
  chapter_id: number;
  chapter_name: string;
  lo_id: number | null;
  lo_name: string | null;
  difficulty: QuestionDifficulty;
  available_count: number;
}

export interface PoolRulePayload {
  chapter_id: number;
  lo_id: number | null;
  difficulty: QuestionDifficulty;
  draw_count: number;
  max_score_per_question: number;
}

export interface PoolRule extends PoolRulePayload {
  rule_id: number;
  chapter_name: string;
  lo_name: string | null;
  available_count: number;
  eligible_count: number;
  included_count: number;
  excluded_count: number;
}

export interface PoolConfig {
  pool_config_id: number;
  exam_id: number;
  subject_id: string;
  subject_name: string;
  fixed_randomization: boolean;
  version: number;
  mode: "manual" | "fixed_randomization" | "pool";
  total_questions: number;
  total_included_candidates: number;
  rules: PoolRule[];
}

export interface PoolCandidate {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  question_difficulties: QuestionDifficulty;
  subject_id: string;
  question_status: QuestionStatus;
  included: boolean;
  chapters: ChapterSummary[];
  learning_objectives: LearningObjectiveSummary[];
  chapter_ids: number[];
  lo_ids: number[];
  creator: { school_id: string; full_name: string } | null;
  options: Array<{ options_id: number; options_text: string; is_correct: boolean }>;
}

export interface PoolCandidateResponse {
  rule: PoolRule;
  questions: PoolCandidate[];
}

export interface PoolPreview {
  exam_id: number;
  seed: string;
  total_questions: number;
  groups: Array<{
    rule_id: number;
    chapter_name: string | null;
    lo_name: string | null;
    difficulty: QuestionDifficulty;
    questions: Array<{
      question_id: number;
      question_text: string;
      question_type: QuestionType;
    }>;
  }>;
}

/** What one document import did, so the teacher can see it reused rather than copied. */
export interface ExamQuestionImportSummary {
  success: boolean;
  /** Every question the file placed in the exam, newly linked or already there. */
  question_ids: number[];
  /** The exam version this import claimed; the next write must send it. */
  version: number;
  reused: number;
  proposed_edit: number;
  updated_own: number;
  created: number;
  already_in_exam: number;
  attached: number;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export const questionService = {
  /** Question document template, with this exam's subject already filled in. */
  async downloadExamQuestionTemplate(examId: number): Promise<void> {
    const { data } = await apiClient.get(`/api/teacher/exams/${examId}/question-template`, {
      responseType: "blob",
    });
    triggerDownload(data as Blob, `exam-${examId}-questions.docx`);
  },

  /** Adds the questions in a filled template to the exam. */
  async importExamQuestionsDocument(
    examId: number,
    file: File,
    expectedVersion?: number,
  ): Promise<ExamQuestionImportSummary> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<ExamQuestionImportSummary>(
      `/api/teacher/exams/${examId}/questions/import-document`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        params: expectedVersion !== undefined ? { expected_version: expectedVersion } : undefined,
      },
    );
    return data;
  },

  /** The chapters and learning objectives available to this exam's subject. */
  async downloadExamQuestionGuideline(examId: number): Promise<void> {
    const { data } = await apiClient.get(`/api/teacher/exams/${examId}/question-guideline`, {
      responseType: "blob",
    });
    triggerDownload(data as Blob, `exam-${examId}-questions-guideline.docx`);
  },

  async create(payload: CreateQuestionRequest & { expected_version?: number }): Promise<number> {
    const { data } = await apiClient.post<{ question_id: number }>("/api/teacher/add-question", payload);
    return data.question_id;
  },

  async addToExam(examId: number, payload: { question_id: number; max_score: number; options?: QuestionOptionRequest[] }) {
    const { data } = await apiClient.post(`/api/teacher/${examId}/add-question`, { exam_id: examId, ...payload });
    return data;
  },

  async updateInExam(examId: number, questionId: number, payload: UpdateQuestionRequest & { expected_version?: number }): Promise<QuestionUpdateResponse> {
    const { data } = await apiClient.put<QuestionUpdateResponse>(`/api/teacher/${examId}/update-question/${questionId}`, payload);
    return data;
  },

  async getExamQuestions(examId: number): Promise<ExamQuestionDetail[]> {
    const { data } = await apiClient.get<ExamQuestionDetail[]>(`/api/teacher/${examId}/get_exam_questions/`);
    return data;
  },

  async removeFromExam(
    examId: number,
    questionId: number,
    expectedVersion?: number,
  ): Promise<{ version: number }> {
    const { data } = await apiClient.delete<{ success: boolean; version: number }>(
      `/api/teacher/${examId}/delete-question/${questionId}`,
      { params: { expected_version: expectedVersion } },
    );
    return data;
  },

  async bulkRemove(examId: number, questionIds: number[], expectedVersion?: number) {
    const { data } = await apiClient.post<{
      success: boolean;
      /** The exam version this write claimed; the next write must send it. */
      version: number;
      removed_count: number;
      removed_question_ids: number[];
    }>(`/api/teacher/${examId}/questions/bulk-remove`, { question_ids: questionIds, expected_version: expectedVersion });
    return data;
  },

  async getPoolAvailability(examId: number, subjectId?: string) {
    const { data } = await apiClient.get<{ subject_id: string; rows: PoolAvailabilityRow[] }>(
      `/api/teacher/exams/${examId}/pool-availability`,
      { params: subjectId ? { subject_id: subjectId } : undefined },
    );
    return data;
  },

  async getPoolConfig(examId: number): Promise<PoolConfig | { exam_id: number; mode: "manual"; config: null }> {
    const { data } = await apiClient.get(`/api/teacher/exams/${examId}/pool-config`);
    return data;
  },

  async savePoolConfig(
    examId: number,
    payload: { subject_id: string; fixed_randomization: boolean; rules: PoolRulePayload[]; expected_version?: number },
  ): Promise<PoolConfig> {
    const { data } = await apiClient.put<PoolConfig>(
      `/api/teacher/exams/${examId}/pool-config`,
      payload,
    );
    return data;
  },

  async getPoolRuleQuestions(examId: number, ruleId: number): Promise<PoolCandidateResponse> {
    const { data } = await apiClient.get<PoolCandidateResponse>(
      `/api/teacher/exams/${examId}/pool-rules/${ruleId}/questions`,
    );
    return data;
  },

  async savePoolRuleCandidates(
    examId: number,
    ruleId: number,
    includedQuestionIds: number[], expectedVersion?: number,
  ): Promise<PoolConfig> {
    const { data } = await apiClient.put<PoolConfig>(
      `/api/teacher/exams/${examId}/pool-rules/${ruleId}/candidates`,
      { included_question_ids: includedQuestionIds, expected_version: expectedVersion },
    );
    return data;
  },

  async previewPool(examId: number, seed?: string): Promise<PoolPreview> {
    const { data } = await apiClient.get<PoolPreview>(
      `/api/teacher/exams/${examId}/pool-preview`,
      { params: seed ? { seed } : undefined },
    );
    return data;
  },

  async updatePoolCandidate(
    examId: number,
    ruleId: number,
    questionId: number,
    payload: UpdateQuestionRequest & { expected_version?: number },
  ): Promise<QuestionUpdateResponse> {
    const { data } = await apiClient.put<QuestionUpdateResponse>(
      `/api/teacher/exams/${examId}/pool-rules/${ruleId}/questions/${questionId}`,
      payload,
    );
    return data;
  },

  async exitPoolMode(examId: number, expectedVersion?: number) {
    const { data } = await apiClient.post<{
      success: boolean;
      mode: "manual";
      materialized_count: number;
      question_ids: number[];
    }>(`/api/teacher/exams/${examId}/pool-config/exit`, undefined, { params: { expected_version: expectedVersion } });
    return data;
  },

  async listImportCandidates(
    examId: number,
    params: QuestionImportCandidateParams,
  ): Promise<QuestionImportCandidateResponse> {
    const { data } = await apiClient.get<QuestionImportCandidateResponse>(
      `/api/teacher/exams/${examId}/question-import-candidates`,
      { params },
    );
    return data;
  },

  async importFromBank(
    examId: number,
    questions: Array<{ question_id: number; expected_version?: number }>,
  ): Promise<ImportQuestionsResponse> {
    const { data } = await apiClient.post<ImportQuestionsResponse>(
      `/api/teacher/add-questions-to-exam-from-question-bank/${examId}`,
      questions,
    );
    return data;
  },
};
