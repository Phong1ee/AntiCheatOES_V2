import { apiClient } from "./api-client";

export interface CreateQuestionRequest {
  question_text: string;
  question_difficulties: "easy" | "medium" | "hard";
  question_type: "MCQ" | "essay";
  chapter_id: number;
  question_status: "draft" | "pending" | "approved" | "rejected";
}

export interface QuestionOptionRequest {
  options_id?: number;
  options_text: string;
  is_correct: boolean;
}

export interface ExamQuestionDetail {
  question_id: number;
  question_text: string;
  question_difficulties: "easy" | "medium" | "hard";
  question_type: "MCQ" | "essay";
  chapter_id: number;
  options: Array<{ options_id: number; options_text: string; is_correct: boolean }>;
}

interface ExamQuestionLink { question_id: number; question_point: number; }

export const questionService = {
  async create(payload: CreateQuestionRequest): Promise<number> {
    const { data } = await apiClient.post<{ question_id: number }>("/api/teacher/add-question", payload);
    return data.question_id;
  },

  async addToExam(examId: number, payload: { question_id: number; question_point: number; options: QuestionOptionRequest[] }) {
    const { data } = await apiClient.post(`/api/teacher/${examId}/add-question`, {
      exam_id: examId,
      ...payload,
    });
    return data;
  },

  async updateInExam(examId: number, questionId: number, payload: { question_point: number; options: QuestionOptionRequest[] }): Promise<void> {
    await apiClient.put(`/api/teacher/${examId}/update-question/${questionId}`, payload);
  },

  async getExamQuestions(examId: number): Promise<Array<ExamQuestionDetail & { question_point: number }>> {
    const { data: links } = await apiClient.get<ExamQuestionLink[]>(`/api/teacher/${examId}/get_exam_questions/`);
    return Promise.all(links.map(async (link) => {
      const { data } = await apiClient.get<ExamQuestionDetail>(`/api/teacher/${examId}/get_exam_question//${link.question_id}`);
      return { ...data, question_point: link.question_point };
    }));
  },
};
