import type { AntiCheatMeasures } from '../anti-cheat/measure-policy';

import type { RichContent, QuestionLayout } from "./rich-content";
export interface QuestionOption extends RichContent {
  id: number;
  text: string;
}

export interface StudentQuestion extends RichContent {
  layout?: QuestionLayout;
  attemptId?: number;
  id: number;
  text: string;
  /** Whether the question carries an image; the bytes come from its own endpoint. */
  hasImage?: boolean;
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
  questionsPerPage?: number;
  autoSubmitOnExpire: boolean;
  sequentialNavigation: boolean;
  antiCheatEnabled: boolean;
  violationLimit: number;
  antiCheatMeasures: AntiCheatMeasures;
}

export interface StudentExamAttempt {
  attemptId: number;
  attemptNo: number;
  status: string;
  startTime?: string;
  lastSavedAt?: string | null;
  violationCount?: number;
  isLocked?: boolean;
  lockReason?: string | null;
}
