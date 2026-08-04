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
  date: string | null;
  duration: string;
  status: StudentResultStatus;
  score: number | null;
  gradingScale: number;
  rawEarnedScore: number | null;
  rawPossibleScore: number;
  totalPoints: number;
  passingScore: number | null;
  correctAnswers: number | null;
  totalQuestions: number;
  timeTaken: string;
  scoreVisible: boolean;
  allowViewDetails: boolean;
  attemptNumber: number | null;
  maxAttempts: number | null;
  attemptStatus: "submitted" | "terminated" | string | null;
  terminated: boolean;
  passed: boolean | null;
  rawScore?: number | null;
  questions?: StudentResultQuestion[];
}
