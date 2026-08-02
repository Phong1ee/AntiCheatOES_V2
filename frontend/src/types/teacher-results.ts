export type ExamResultStatus = "scheduled" | "in-progress" | "completed";
export type StudentResultStatus = "submitted" | "late" | "not-submitted";
export type QuestionKind = "mcq" | "true-false" | "essay";
export type ResultStrategy = "highest" | "average" | "last_attempt";

interface ExamResultStatsApi {
  totalStudents: number;
  submittedCount: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  totalQuestions: number;
  hasEssayQuestions: boolean;
  pendingEssayCount: number;
  totalEssayCount: number;
  resultStrategy: ResultStrategy;
}

export interface ExamResultSummary extends ExamResultStatsApi {
  id: string;
  examId: number;
  examName: string;
  subject: string;
  date: string | null;
  endDate: string | null;
  duration: number | null;
  status: ExamResultStatus;
}

export interface ExamResultsOverview extends ExamResultStatsApi {
  examId: number;
  examName: string;
  subject: string;
  startDate: string | null;
  endDate: string | null;
  status: ExamResultStatus;
}

export interface StudentAttemptSummary {
  attemptId: number;
  attemptNumber: number | null;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: string;
  status: "submitted" | "late";
  submittedAt: string | null;
}

export interface StudentResult {
  id: string;
  attemptId: number | null;
  studentId: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: string;
  status: StudentResultStatus;
  submittedAt: string | null;
  /** Every submitted attempt this student made on this exam (the row above summarizes the exam's final-score strategy). */
  attempts: StudentAttemptSummary[];
}

export interface StudentAttemptQuestion {
  questionNumber: number;
  question: string;
  type: QuestionKind;
  correctAnswer: string | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  points: number;
  maxPoints: number;
}

export interface StudentAttemptDetail {
  attemptId: number;
  studentId: string | null;
  studentName: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: string;
  startTime: string | null;
  submitTime: string | null;
  questions: StudentAttemptQuestion[];
}

export interface QuestionOptionStat {
  option: string;
  label: string;
  isCorrect: boolean;
  percentage: number;
}

export interface QuestionStat {
  questionNumber: number;
  questionText: string;
  type: QuestionKind;
  difficulty: string;
  correctRate: number;
  totalAttempts: number;
  correctOption: string | null;
  optionStats: QuestionOptionStat[] | null;
}

export interface EssayGradingItem {
  essayAnswerId: number;
  attemptId: number;
  attemptNumber: number | null;
  studentId: string;
  studentName: string;
  questionId: number;
  question: string;
  answer: string | null;
  maxPoints: number;
  currentScore: number | null;
  status: "pending" | "graded";
}

export interface GradeEssayResult {
  essayAnswerId: number;
  currentScore: number;
  status: "graded";
  attemptScore: number;
}
