export interface QuestionOption {
  id: number;
  text: string;
}

export interface StudentQuestion {
  id: number;
  text: string;
  type: "multiple-choice" | "true-false" | "essay";
  points: number;
  options: QuestionOption[];
  savedAnswer?: StudentAnswer;
}

export type StudentAnswer =
  | { selectedOptionId: number; revision?: number }
  | { answerText: string; revision?: number };

export interface AutoSaveResult {
  savedAt: string | null;
  stale: boolean;
  storedRevision: number;
}

export type StudentAnswers = Record<number, StudentAnswer>;

export interface StudentExamSettings {
  autoSubmitOnExpire: boolean;
  sequentialNavigation: boolean;
  antiCheatEnabled: boolean;
  violationLimit: number;
}

export interface StudentExamAttempt {
  attemptId: number;
  attemptNo: number;
  status: string;
  startTime?: string;
  lastSavedAt?: string | null;
  violationCount?: number;
}
