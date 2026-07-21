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
  question_point: number;
}

export interface UpdateQuestionRequest extends Omit<CreateQuestionRequest, "exam_id"> {}

export interface ExamQuestionDetail {
  question_id: number;
  question_text: string;
  question_difficulties: QuestionDifficulty | null;
  question_type: QuestionType;
  subject_id: string;
  chapter_ids: number[];
  lo_ids: number[];
  question_status: "draft" | "pending" | "approved" | "rejected";
  question_point: number;
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
  creator: { id: number; school_id: string; full_name: string } | null;
}

export interface QuestionImportCandidateParams {
  search?: string;
  question_type?: QuestionType;
  difficulty?: QuestionDifficulty;
  subject_id?: string;
  status?: QuestionStatus;
  created_by?: number;
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
    creators: Array<{ id: number; school_id: string; full_name: string }>;
    statuses: QuestionStatus[];
    current_teacher_id: number;
  };
}

export interface ImportQuestionsResponse {
  success: boolean;
  imported_count: number;
  imported_question_ids: number[];
}

export const questionService = {
  async create(payload: CreateQuestionRequest): Promise<number> {
    const { data } = await apiClient.post<{ question_id: number }>("/api/teacher/add-question", payload);
    return data.question_id;
  },

  async addToExam(examId: number, payload: { question_id: number; question_point: number; options?: QuestionOptionRequest[] }) {
    const { data } = await apiClient.post(`/api/teacher/${examId}/add-question`, { exam_id: examId, ...payload });
    return data;
  },

  async updateInExam(examId: number, questionId: number, payload: UpdateQuestionRequest): Promise<void> {
    await apiClient.put(`/api/teacher/${examId}/update-question/${questionId}`, payload);
  },

  async getExamQuestions(examId: number): Promise<ExamQuestionDetail[]> {
    const { data } = await apiClient.get<ExamQuestionDetail[]>(`/api/teacher/${examId}/get_exam_questions/`);
    return data;
  },

  async removeFromExam(examId: number, questionId: number): Promise<void> {
    await apiClient.delete(`/api/teacher/${examId}/delete-question/${questionId}`);
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
    questions: Array<{ question_id: number; question_point: number }>,
  ): Promise<ImportQuestionsResponse> {
    const { data } = await apiClient.post<ImportQuestionsResponse>(
      `/api/teacher/add-questions-to-exam-from-question-bank/${examId}`,
      questions,
    );
    return data;
  },
};
