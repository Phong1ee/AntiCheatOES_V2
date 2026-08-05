export type StudentResultStatus = "published" | "pending" | "hidden";
export type StudentQuestionGradingStatus = "graded" | "pending" | "blank";

export interface StudentResultQuestion {
  id: number;
  type: "mcq" | "essay";
  topic?: string | null;
  isCorrect?: boolean;
  question: string;
  options?: string[];
  studentAnswer?: string | null;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  maxPoints: number;
  awardedPoints: number | null;
  gradingStatus: StudentQuestionGradingStatus;
  /** Legacy aliases: points is maxPoints and score is awardedPoints. */
  points?: number;
  score?: number | null;
}

export interface StudentExamResult {
  id: string;
  attemptId: number;
  examId: number;
  examTitle: string;
  subject: string;
  subjectId?: string | null;
  subjectName?: string;
  date: string | null;
  duration: string;
  status: StudentResultStatus;
  score: number | null;
  attemptScore?: number | null;
  finalScore?: number | null;
  resultStrategy?: "highest" | "average" | "last_attempt";
  resultVisibility?: "hidden" | "score-only" | "full";
  resultStatus?: StudentResultStatus;
  gradingPending?: boolean;
  essayPending?: boolean;
  gradingScale: number;
  rawEarnedScore: number | null;
  rawPossibleScore: number;
  totalPoints: number;
  passingScore: number | null;
  correctAnswers: number | null;
  totalQuestions: number;
  timeTaken: string;
  submittedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  scoreVisible: boolean;
  allowViewDetails: boolean;
  attemptNumber: number | null;
  maxAttempts: number | null;
  attemptStatus: "submitted" | "terminated" | string | null;
  terminated: boolean;
  terminationReason?: string | null;
  passed: boolean | null;
  rawScore?: number | null;
  questions?: StudentResultQuestion[];
}

export interface StudentExamResultGroup {
  examId: number;
  examTitle: string;
  subjectId: string | null;
  subjectName: string;
  maxAttempts: number | null;
  finalScore: number | null;
  resultStrategy: "highest" | "average" | "last_attempt";
  passingScore: number | null;
  resultVisibility: "hidden" | "score-only" | "full";
  gradingPending: boolean;
  latestAttempt: StudentExamResult;
  attempts: StudentExamResult[];
}
