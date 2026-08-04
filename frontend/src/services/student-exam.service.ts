import { apiClient } from "./api-client";
import type { StudentAnswer, StudentAnswers, StudentExamAttempt, StudentExamSettings, StudentQuestion } from "../types/student-exam";

interface RawQuestion {
  id: number;
  question_id?: number;
  text: string;
  type: StudentQuestion["type"];
  points?: number;
  options?: StudentQuestion["options"];
  savedAnswer?: StudentAnswer;
}

interface RawExam {
  exam_id: number;
  examcode?: string | null;
  title: string;
  duration_minutes: number;
  status: "upcoming" | "open" | "completed" | "closed";
  max_attempt: number | null;
  attempts_used: number;
  has_open_attempt?: boolean;
  open_attempt_id?: number | null;
  can_resume?: boolean;
  start_time?: string;
  end_time?: string;
  description?: string | null;
  requires_fullscreen?: boolean;
}

interface RawVerifyCodeResult {
  examId?: number;
  exam_id?: number;
  requiresFullscreen?: boolean;
  settings?: Record<string, unknown>;
}

interface RawRestore {
  exam: { exam_id: number; title: string; duration_minutes: number };
  attempt: { attempt_id: number; attempt_no: number; status: string; start_time?: string; lastSavedAt?: string | null };
  questions?: RawQuestion[];
  serverTime: string;
  expiresAt: string;
  remainingSeconds: number;
  settings?: Record<string, unknown>;
}

export interface StudentExamListItem {
  id: string;
  title: string;
  subject: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  status: RawExam["status"];
  maxAttempts: number | null;
  attemptsUsed: number;
  hasOpenAttempt: boolean;
  openAttemptId: number | null;
  canResume: boolean;
  requiresFullscreen: boolean;
  examCode: string | null;
}

export interface StudentExamListResponse {
  exams: StudentExamListItem[];
  serverTime: string;
}

export interface VerifyCodeResult {
  examId: number;
  requiresFullscreen: boolean;
  settings: StudentExamSettings;
}

export interface StartExamResult extends StudentExamAttempt {
  examId: number;
  durationMinutes: number;
  resumed: boolean;
  serverTime: string;
  expiresAt: string;
  remainingSeconds: number;
}

export interface RestoreAttemptResult {
  exam: { examId: number; title: string; durationMinutes: number };
  attempt: StudentExamAttempt;
  questions: StudentQuestion[];
  serverTime: string;
  expiresAt: string;
  remainingSeconds: number;
  settings: StudentExamSettings;
}

const normalizeQuestion = (question: RawQuestion): StudentQuestion => ({
  id: question.id ?? question.question_id ?? 0,
  text: question.text,
  type: question.type,
  points: Number(question.points ?? 0),
  options: question.options ?? [],
  savedAnswer: question.savedAnswer,
});

const normalizeSettings = (settings?: Record<string, unknown>): StudentExamSettings => ({
  autoSubmitOnExpire: Boolean(settings?.auto_submit_on_expire ?? settings?.autoSubmitOnExpire ?? true),
  sequentialNavigation: Boolean(settings?.sequential_navigation ?? settings?.sequentialNavigation ?? false),
  tabSwitchThreshold: Number(settings?.tab_switch_thresh ?? settings?.tabSwitchThreshold ?? 0),
  copyPasteThreshold: Number(settings?.copy_paste_thresh ?? settings?.copyPasteThreshold ?? 0),
  fullscreenExitThreshold: Number(settings?.force_fullscreen_thresh ?? settings?.fullscreenExitThreshold ?? 0),
});

const normalizeExam = (exam: RawExam): StudentExamListItem => ({
  id: String(exam.exam_id), title: exam.title, subject: exam.description ?? "General",
  startTime: exam.start_time, endTime: exam.end_time, durationMinutes: exam.duration_minutes,
  status: exam.status, maxAttempts: exam.max_attempt, attemptsUsed: exam.attempts_used,
  hasOpenAttempt: Boolean(exam.has_open_attempt), openAttemptId: exam.open_attempt_id ?? null,
  canResume: Boolean(exam.can_resume), requiresFullscreen: Boolean(exam.requires_fullscreen),
  examCode: exam.examcode ?? null,
});

export const studentExamService = {
  async list(): Promise<StudentExamListItem[]> {
    return (await this.listWithMeta()).exams;
  },

  async listWithMeta(): Promise<StudentExamListResponse> {
    const { data } = await apiClient.get<{ exams?: RawExam[]; serverTime?: string }>("/api/exams");
    return {
      exams: (data.exams ?? []).map(normalizeExam),
      serverTime: data.serverTime ?? new Date().toISOString(),
    };
  },

  async verifyCode(examId: string | number, code?: string): Promise<VerifyCodeResult> {
    const { data } = await apiClient.post<RawVerifyCodeResult>(`/api/exams/${examId}/verify-code`, { code });
    return {
      examId: Number(data.examId ?? data.exam_id ?? examId),
      requiresFullscreen: Boolean(data.requiresFullscreen),
      settings: normalizeSettings(data.settings),
    };
  },

  async start(examId: string | number, code?: string): Promise<StartExamResult> {
    const { data } = await apiClient.post<Record<string, unknown>>(`/api/exams/${examId}/start`, { code });
    return {
      examId: Number(data.examId ?? data.exam_id), attemptId: Number(data.attemptId ?? data.attempt_id),
      attemptNo: Number(data.attemptNo ?? data.attempt_no), durationMinutes: Number(data.duration_minutes),
      resumed: Boolean(data.resumed), status: String(data.status ?? "in_progress"),
      serverTime: String(data.serverTime), expiresAt: String(data.expiresAt), remainingSeconds: Number(data.remainingSeconds),
    };
  },

  async restore(examId: string | number, attemptId: number): Promise<RestoreAttemptResult> {
    const { data } = await apiClient.get<RawRestore>(`/api/exams/${examId}/attempts/${attemptId}`);
    return {
      exam: { examId: Number(data.exam.exam_id), title: data.exam.title, durationMinutes: Number(data.exam.duration_minutes) },
      attempt: { attemptId: Number(data.attempt.attempt_id), attemptNo: Number(data.attempt.attempt_no), status: data.attempt.status, startTime: data.attempt.start_time, lastSavedAt: data.attempt.lastSavedAt },
      questions: (data.questions ?? []).map(normalizeQuestion), serverTime: data.serverTime,
      expiresAt: data.expiresAt, remainingSeconds: Number(data.remainingSeconds), settings: normalizeSettings(data.settings),
    };
  },

  async saveAnswer(examId: string | number, attemptId: number, questionId: number, answer: StudentAnswer) {
    const { data } = await apiClient.put<{ savedAt: string }>(`/api/exams/${examId}/attempts/${attemptId}/answers/${questionId}`, answer);
    return data;
  },

  async submit(examId: string | number, attemptId: number, answers: StudentAnswers) {
    const payload = Object.entries(answers)
      .filter(([, answer]) => !("answerText" in answer) || Boolean(answer.answerText.trim()))
      .map(([questionId, answer]) => ({ questionId: Number(questionId), ...answer }));
    const { data } = await apiClient.post(`/api/exams/${examId}/submit`, { attemptId, answers: payload });
    return data;
  },

  async terminate(examId: string | number, attemptId: number, reason: string, violationType: string, answers: StudentAnswers) {
    const payload = Object.entries(answers)
      .filter(([, answer]) => !("answerText" in answer) || Boolean(answer.answerText.trim()))
      .map(([questionId, answer]) => ({ questionId: Number(questionId), ...answer }));
    const { data } = await apiClient.post(`/api/exams/${examId}/attempts/${attemptId}/terminate`, { reason, violationType, answers: payload });
    return data;
  },
};
