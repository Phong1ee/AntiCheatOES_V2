import { apiClient } from "./api-client";

export type QuestionType = "MCQ" | "essay" | "true-false";
export type QuestionDifficulty = "easy" | "medium" | "hard";

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
  question_difficulties: QuestionDifficulty;
  question_type: QuestionType;
  subject_id: string;
  chapter_ids: number[];
  lo_ids: number[];
  question_status: "draft" | "pending" | "approved" | "rejected";
  question_point: number;
  options: Array<{ options_id: number; options_text: string; is_correct: boolean }>;
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
};
