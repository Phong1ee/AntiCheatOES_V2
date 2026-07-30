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
  | { selectedOptionId: number }
  | { answerText: string };

export type StudentAnswers = Record<number, StudentAnswer>;

export interface StudentExamSettings {
  autoSubmitOnExpire: boolean;
  tabSwitchThreshold: number;
  copyPasteThreshold: number;
  fullscreenExitThreshold: number;
}

export interface StudentExamAttempt {
  attemptId: number;
  attemptNo: number;
  status: string;
  startTime?: string;
  lastSavedAt?: string | null;
}
