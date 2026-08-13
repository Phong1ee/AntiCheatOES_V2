import { apiClient } from "./api-client";
import { attemptSessionStorage } from "./attempt-session.storage";
import type { AutoSaveResult, StudentAnswer, StudentAnswers, StudentExamAttempt, StudentExamSettings, StudentQuestion } from "../types/student-exam";

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
  requires_exam_code?: boolean;
  released_examcode?: string | null;
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
  anti_cheat_enabled?: boolean;
  violation_limit?: number;
}

interface RawVerifyCodeResult {
  examId?: number;
  exam_id?: number;
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
  antiCheatEnabled: boolean;
  violationLimit: number;
  requiresExamCode: boolean;
  releasedExamCode: string | null;
}

export interface StudentExamListResponse {
  exams: StudentExamListItem[];
  serverTime: string;
}

export interface VerifyCodeResult {
  examId: number;
  antiCheatEnabled: boolean;
  violationLimit: number;
  settings: StudentExamSettings;
}

export interface StartExamResult extends StudentExamAttempt {
  examId: number;
  durationMinutes: number;
  resumed: boolean;
  serverTime: string;
  expiresAt: string;
  remainingSeconds: number;
  antiCheatEnabled: boolean;
  violationLimit: number;
}

export interface SubmitExamResult {
  success: boolean;
  attemptId: number;
  score: number | null;
  essayPending: boolean;
  resultVisibility: "hidden" | "score-only" | "full";
  status: string;
  submitRequestId?: string | null;
}

export interface AntiCheatEventResult {
  eventAccepted: boolean;
  duplicate: boolean;
  antiCheatEnabled: boolean;
  violationCount: number;
  violationLimit: number;
  remainingViolations: number | null;
  terminated: boolean;
  attemptStatus: string;
  warningMessage?: string | null;
}

export interface ResumeAttemptResult {
  antiCheatEnabled: boolean;
  attemptId: number;
  attemptStatus: string;
  refreshViolationRecorded: boolean;
  remainingViolations: number | null;
  terminated: boolean;
  violationCount: number;
  violationLimit: number;
}

export interface RestoreAttemptResult {
  exam: { examId: number; title: string; durationMinutes: number };
  attempt: StudentExamAttempt;
  questions: StudentQuestion[];
  serverTime: string;
  expiresAt: string;
  remainingSeconds: number;
  settings: StudentExamSettings;
  antiCheatEnabled: boolean;
  violationCount: number;
  violationLimit: number;
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
  antiCheatEnabled: Boolean(settings?.anti_cheat_enabled ?? settings?.antiCheatEnabled ?? false),
  violationLimit: Number(settings?.violation_limit ?? settings?.violationLimit ?? 5),
});

const normalizeExam = (exam: RawExam): StudentExamListItem => ({
  id: String(exam.exam_id), title: exam.title, subject: exam.description ?? "General",
  startTime: exam.start_time, endTime: exam.end_time, durationMinutes: exam.duration_minutes,
  status: exam.status, maxAttempts: exam.max_attempt, attemptsUsed: exam.attempts_used,
  hasOpenAttempt: Boolean(exam.has_open_attempt), openAttemptId: exam.open_attempt_id ?? null,
  canResume: Boolean(exam.can_resume), antiCheatEnabled: Boolean(exam.anti_cheat_enabled), violationLimit: Number(exam.violation_limit ?? 5),
  requiresExamCode: Boolean(exam.requires_exam_code),
  releasedExamCode: exam.released_examcode?.trim() || null,
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
      antiCheatEnabled: Boolean(data.antiCheatEnabled), violationLimit: Number(data.violationLimit ?? 5),
      settings: normalizeSettings(data.settings),
    };
  },

  async start(examId: string | number, code?: string): Promise<StartExamResult> {
    const { data } = await apiClient.post<Record<string, unknown>>(`/api/exams/${examId}/start`, {
      code,
      deviceId: attemptSessionStorage.getDeviceId(),
    });
    const result = {
      examId: Number(data.examId ?? data.exam_id), attemptId: Number(data.attemptId ?? data.attempt_id),
      attemptNo: Number(data.attemptNo ?? data.attempt_no), durationMinutes: Number(data.duration_minutes),
      resumed: Boolean(data.resumed), status: String(data.status ?? "in_progress"),
      serverTime: String(data.serverTime), expiresAt: String(data.expiresAt), remainingSeconds: Number(data.remainingSeconds),
      violationCount: Number(data.violationCount ?? 0), antiCheatEnabled: Boolean(data.antiCheatEnabled), violationLimit: Number(data.violationLimit ?? 5),
    };
    const sessionToken = String(data.sessionToken ?? "");
    if (!sessionToken) throw new Error("Server did not create an attempt session.");
    attemptSessionStorage.setSessionToken(result.attemptId, sessionToken);
    return result;
  },

  async restore(examId: string | number, attemptId: number): Promise<RestoreAttemptResult> {
    const { data } = await apiClient.get<RawRestore & Record<string, unknown>>(`/api/exams/${examId}/attempts/${attemptId}`, { headers: attemptSessionStorage.headers(attemptId) });
    return {
      exam: { examId: Number(data.exam.exam_id), title: data.exam.title, durationMinutes: Number(data.exam.duration_minutes) },
      attempt: { attemptId: Number(data.attempt.attempt_id), attemptNo: Number(data.attempt.attempt_no), status: data.attempt.status, startTime: data.attempt.start_time, lastSavedAt: data.attempt.lastSavedAt, violationCount: Number(data.violationCount ?? 0) },
      questions: (data.questions ?? []).map(normalizeQuestion), serverTime: data.serverTime,
      expiresAt: data.expiresAt, remainingSeconds: Number(data.remainingSeconds), settings: normalizeSettings(data.settings),
      antiCheatEnabled: Boolean(data.antiCheatEnabled), violationCount: Number(data.violationCount ?? 0), violationLimit: Number(data.violationLimit ?? 5),
    };
  },

  async saveAnswer(examId: string | number, attemptId: number, questionId: number, answer: StudentAnswer, revision: number): Promise<AutoSaveResult> {
    const { revision: _savedRevision, ...payload } = answer;
    const { data } = await apiClient.put<AutoSaveResult>(`/api/exams/${examId}/attempts/${attemptId}/answers/${questionId}`, { ...payload, revision }, { headers: attemptSessionStorage.headers(attemptId) });
    return data;
  },

  async submit(examId: string | number, attemptId: number, answers: StudentAnswers, submitRequestId: string): Promise<SubmitExamResult> {
    const payload = Object.entries(answers)
      .filter(([, answer]) => !("answerText" in answer) || Boolean(answer.answerText.trim()))
      .map(([questionId, answer]) => {
        const { revision: _savedRevision, ...submitAnswer } = answer;
        return { questionId: Number(questionId), ...submitAnswer };
      });
    const { data } = await apiClient.post<SubmitExamResult>(`/api/exams/${examId}/submit`, { attemptId, answers: payload, submitRequestId }, { headers: attemptSessionStorage.headers(attemptId) });
    attemptSessionStorage.clearSessionToken(attemptId);
    attemptSessionStorage.clearSubmitRequestId(attemptId);
    return data;
  },


  async resume(examId: string | number, attemptId: number, resumeCause: "page_refresh" | "unexpected_exit" | "normal_resume", clientEventId?: string): Promise<ResumeAttemptResult> {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const pendingRefreshId = resumeCause === "normal_resume" && navigation?.type === "reload" ? attemptSessionStorage.getPendingRefresh(attemptId) : null;
    const actualCause = pendingRefreshId ? "page_refresh" : resumeCause;
    const actualEventId = pendingRefreshId ?? clientEventId;
    const { data } = await apiClient.post<Record<string, unknown>>(`/api/exams/${examId}/attempts/${attemptId}/resume`, {
      deviceId: attemptSessionStorage.getDeviceId(), resumeCause: actualCause, clientEventId: actualEventId,
    });
    const sessionToken = String(data.sessionToken ?? "");
    if (!sessionToken) throw new Error("Server did not rotate the attempt session.");
    attemptSessionStorage.setSessionToken(attemptId, sessionToken);
    if (actualCause === "page_refresh" && actualEventId) attemptSessionStorage.clearPendingRefresh(attemptId);
    const antiCheatEnabled = Boolean(data.antiCheatEnabled);
    const violationCount = Number(data.violationCount ?? 0);
    const violationLimit = Number(data.violationLimit ?? 5);
    return {
      antiCheatEnabled,
      attemptId: Number(data.attemptId ?? attemptId),
      attemptStatus: String(data.attemptStatus ?? "in_progress"),
      // This only controls the warning UI; the server remains authoritative for the event and count.
      refreshViolationRecorded: actualCause === "page_refresh" && antiCheatEnabled,
      remainingViolations: antiCheatEnabled ? Math.max(violationLimit - violationCount, 0) : null,
      terminated: Boolean(data.terminated),
      violationCount,
      violationLimit,
    };
  },

  async recordAntiCheatEvent(examId: string | number, attemptId: number, clientEventId: string, eventType: string, source: "browser" | "camera" | "microphone", details?: string, metadata?: Record<string, unknown>): Promise<AntiCheatEventResult> {
    const { data } = await apiClient.post<AntiCheatEventResult>(`/api/exams/${examId}/events`, {
      attemptId, clientEventId, eventType, source, details, metadata,
    }, { headers: attemptSessionStorage.headers(attemptId) });
    return data;
  },

  async heartbeat(examId: string | number, attemptId: number) {
    const { data } = await apiClient.post(`/api/exams/${examId}/attempts/${attemptId}/heartbeat`, undefined, { headers: attemptSessionStorage.headers(attemptId) });
    return data;
  },
};
