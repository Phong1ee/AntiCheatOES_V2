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

export type ImportTaxonomyAction = "reuse" | "create" | "conflict";
export type ImportQuestionStatus = "valid" | "duplicate" | "error";

export interface AdminQuestionImportSubject {
  subject_id: string;
  subject_name: string;
  subject_description?: string;
  status: "valid" | "new";
  warnings: string[];
}

export interface AdminQuestionImportChapter {
  chapter_name: string;
  action: ImportTaxonomyAction;
  chapter_id?: number;
}

export interface AdminQuestionImportLearningObjective {
  chapter_name: string;
  lo_name: string;
  action: ImportTaxonomyAction;
  lo_id?: number;
}

export interface AdminQuestionImportPreviewQuestion {
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  chapter_name: string;
  learning_objectives: string[];
  status: ImportQuestionStatus;
  errors: string[];
  warnings: string[];
}

export interface AdminQuestionImportPreview {
  subject: AdminQuestionImportSubject;
  chapters: AdminQuestionImportChapter[];
  learning_objectives: AdminQuestionImportLearningObjective[];
  questions: AdminQuestionImportPreviewQuestion[];
  summary: {
    total_questions: number;
    valid_questions: number;
    duplicate_questions: number;
    error_questions: number;
    chapters_to_create: number;
    learning_objectives_to_create: number;
  };
}

export interface AdminQuestionImportResult {
  subject_id: string;
  imported_count: number;
  duplicate_skipped_count: number;
  chapters_created: number;
  learning_objectives_created: number;
  question_ids: number[];
}

export interface AdminNewSubjectQuestionImportResult extends AdminQuestionImportResult {
  subject: {
    subject_id: string;
    subject_name: string;
    subject_description: string;
  };
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

  async previewImport(file: File, subjectId: string): Promise<AdminQuestionImportPreview> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject_id", subjectId);
    const { data } = await apiClient.post<AdminQuestionImportPreview>(
      "/api/admin/question-bank/import/preview",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async importQuestions(file: File, subjectId: string): Promise<AdminQuestionImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject_id", subjectId);
    const { data } = await apiClient.post<AdminQuestionImportResult>(
      "/api/admin/question-bank/import",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async previewNewSubjectImport(file: File): Promise<AdminQuestionImportPreview> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<AdminQuestionImportPreview>(
      "/api/admin/question-bank/import/new-subject/preview",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async importNewSubjectQuestions(file: File): Promise<AdminNewSubjectQuestionImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("confirm", "true");
    const { data } = await apiClient.post<AdminNewSubjectQuestionImportResult>(
      "/api/admin/question-bank/import/new-subject",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
};
