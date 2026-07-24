import { apiClient } from "./api-client";

export type AdminQuestionType = "MCQ" | "essay" | "true-false";
export type AdminQuestionDifficulty = "easy" | "medium" | "hard" | null;

export interface AdminUserSummary {
  id: number;
  school_id: string;
  full_name: string;
}

export interface AdminSubjectSummary {
  subject_id: string;
  subject_name: string;
}

export interface AdminChapterSummary {
  chapter_id: number;
  chapter_name: string;
}

export interface AdminLearningObjectiveSummary {
  lo_id: number;
  lo_name: string;
}

export interface AdminOptionSummary {
  options_id?: number;
  options_text: string;
  is_correct: boolean;
}

export interface AdminQuestionReviewItem {
  question_id: number;
  question_text: string;
  question_type: AdminQuestionType;
  question_difficulties: AdminQuestionDifficulty;
  question_status: "pending" | "approved" | "rejected" | "draft";
  subject: AdminSubjectSummary | null;
  teacher: AdminUserSummary | null;
  chapters: AdminChapterSummary[];
  learning_objectives: AdminLearningObjectiveSummary[];
  options?: AdminOptionSummary[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminRevisionReviewItem {
  revision_id: number;
  question_id: number;
  version_number: number;
  question_text: string;
  question_type: AdminQuestionType;
  question_difficulties: AdminQuestionDifficulty;
  subject_id: string | null;
  subject: AdminSubjectSummary | null;
  question_status: "pending" | "approved" | "rejected";
  options: AdminOptionSummary[];
  chapter_ids: number[];
  chapters: AdminChapterSummary[];
  lo_ids: number[];
  learning_objectives: AdminLearningObjectiveSummary[];
  editor: AdminUserSummary | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminRevisionDetail {
  active_question: AdminQuestionReviewItem;
  proposed_revision: AdminRevisionReviewItem;
}

export interface AdminPendingRevisionItem extends AdminRevisionDetail {}

export interface AdminListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const adminQuestionApprovalService = {
  async listPendingQuestions() {
    const { data } = await apiClient.get<AdminListResponse<AdminQuestionReviewItem>>(
      "/api/admin/questions/pending",
      { params: { page: 1, page_size: 100 } },
    );
    return data;
  },

  async getPendingQuestion(questionId: number) {
    const { data } = await apiClient.get<AdminQuestionReviewItem>(`/api/admin/questions/${questionId}`);
    return data;
  },

  async approveQuestion(questionId: number) {
    await apiClient.post(`/api/admin/questions/${questionId}/approve`);
  },

  async rejectQuestion(questionId: number, reason: string) {
    await apiClient.post(`/api/admin/questions/${questionId}/reject`, { reason });
  },

  async listPendingRevisions() {
    const { data } = await apiClient.get<AdminListResponse<AdminPendingRevisionItem>>(
      "/api/admin/question-revisions/pending",
      { params: { page: 1, page_size: 100 } },
    );
    return data;
  },

  async getRevision(revisionId: number) {
    const { data } = await apiClient.get<AdminRevisionDetail>(`/api/admin/question-revisions/${revisionId}`);
    return data;
  },

  async approveRevision(revisionId: number) {
    await apiClient.post(`/api/admin/question-revisions/${revisionId}/approve`);
  },

  async rejectRevision(revisionId: number, reason: string) {
    await apiClient.post(`/api/admin/question-revisions/${revisionId}/reject`, { reason });
  },
};
