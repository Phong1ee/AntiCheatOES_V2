import { apiClient } from "./api-client";
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionDetail,
  QuestionDifficulty,
  QuestionListResponse,
  QuestionPayload,
  QuestionType,
} from "../types/question-bank";

export interface AdminQuestionListParams {
  subject_id?: string;
  chapter_id?: number;
  lo_id?: number;
  search?: string;
  question_type?: QuestionType;
  difficulty?: QuestionDifficulty;
  page?: number;
  page_size?: number;
}

export interface AdminQuestionSubject {
  subject_id: string;
  subject_name: string;
  subject_description: string;
  approved_question_count: number;
}

function presentParams(params: AdminQuestionListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export const adminQuestionBankService = {
  async listQuestions(params: AdminQuestionListParams): Promise<QuestionListResponse> {
    const { data } = await apiClient.get<QuestionListResponse>("/api/admin/question-bank", {
      params: presentParams(params),
    });
    return data;
  },

  async listSubjects(): Promise<AdminQuestionSubject[]> {
    const { data } = await apiClient.get<AdminQuestionSubject[]>("/api/admin/question-bank/subjects");
    return data;
  },

  async listChapters(subjectId: string): Promise<ChapterSummary[]> {
    const { data } = await apiClient.get<ChapterSummary[]>(
      `/api/admin/question-bank/subjects/${subjectId}/chapters`,
    );
    return data;
  },

  async listLearningObjectives(chapterId: number): Promise<LearningObjectiveSummary[]> {
    const { data } = await apiClient.get<LearningObjectiveSummary[]>(
      `/api/admin/question-bank/chapters/${chapterId}/learning-objectives`,
    );
    return data;
  },

  async getQuestion(questionId: number): Promise<QuestionDetail> {
    const { data } = await apiClient.get<QuestionDetail>(`/api/admin/question-bank/${questionId}`);
    return data;
  },

  async createQuestion(payload: QuestionPayload): Promise<QuestionDetail> {
    const { data } = await apiClient.post<QuestionDetail>("/api/admin/question-bank", payload);
    return data;
  },

  async updateQuestion(questionId: number, payload: QuestionPayload): Promise<QuestionDetail> {
    const { data } = await apiClient.put<QuestionDetail>(`/api/admin/question-bank/${questionId}`, payload);
    return data;
  },

  async deleteQuestion(questionId: number): Promise<void> {
    await apiClient.delete(`/api/admin/question-bank/${questionId}`);
  },
};
