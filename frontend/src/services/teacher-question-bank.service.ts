import { apiClient } from "./api-client";
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionBankListParams,
  QuestionDetail,
  QuestionEditPayload,
  QuestionListResponse,
  QuestionPayload,
  SubjectCountResponse,
} from "../types/question-bank";

function withoutEmptyParams(params: QuestionBankListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export const teacherQuestionBankService = {
  async listBank(params: QuestionBankListParams): Promise<QuestionListResponse> {
    const { data } = await apiClient.get<QuestionListResponse>("/api/teacher/question-bank", {
      params: withoutEmptyParams(params),
    });
    return data;
  },

  async listMine(params: QuestionBankListParams): Promise<QuestionListResponse> {
    const { data } = await apiClient.get<QuestionListResponse>("/api/teacher/question-bank/mine", {
      params: withoutEmptyParams(params),
    });
    return data;
  },

  async listSubjectCounts(scope: "bank" | "mine"): Promise<SubjectCountResponse> {
    const { data } = await apiClient.get<SubjectCountResponse>("/api/teacher/question-bank/subjects", {
      params: { scope },
    });
    return data;
  },

  async listChapters(subjectId: string): Promise<ChapterSummary[]> {
    const { data } = await apiClient.get<ChapterSummary[]>(
      `/api/teacher/question-bank/subjects/${subjectId}/chapters`,
    );
    return data;
  },

  async listLearningObjectives(chapterId: number): Promise<LearningObjectiveSummary[]> {
    const { data } = await apiClient.get<LearningObjectiveSummary[]>(
      `/api/teacher/question-bank/chapters/${chapterId}/learning-objectives`,
    );
    return data;
  },

  async getDetail(questionId: number): Promise<QuestionDetail> {
    const { data } = await apiClient.get<QuestionDetail>(`/api/teacher/question-bank/${questionId}`);
    return data;
  },

  async getEditPayload(questionId: number): Promise<QuestionEditPayload> {
    const { data } = await apiClient.get<QuestionEditPayload>(
      `/api/teacher/question-bank/${questionId}/edit`,
    );
    return data;
  },

  async create(payload: QuestionPayload): Promise<QuestionDetail> {
    const { data } = await apiClient.post<QuestionDetail>("/api/teacher/question-bank", payload);
    return data;
  },

  async update(questionId: number, payload: QuestionPayload): Promise<QuestionDetail> {
    const { data } = await apiClient.put<QuestionDetail>(`/api/teacher/question-bank/${questionId}`, payload);
    return data;
  },

  async submit(questionId: number): Promise<QuestionDetail> {
    const { data } = await apiClient.post<QuestionDetail>(`/api/teacher/question-bank/${questionId}/submit`);
    return data;
  },

  async remove(questionId: number): Promise<void> {
    await apiClient.delete(`/api/teacher/question-bank/${questionId}`);
  },
};
