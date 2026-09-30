export type ExamResultStatus = "scheduled" | "in-progress" | "completed";
export type StudentResultStatus = "submitted" | "late" | "pending-grading" | "not-submitted";
export type QuestionKind = "mcq" | "true-false" | "essay";
export type ResultStrategy = "highest" | "average" | "last_attempt";

export interface ScoreDistributionBucket {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

export interface ResultBreakdownItem {
  key: string;
  label: string;
  count: number;
}

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
  gradingScale: number;
  passingScore: number;
  /** Number of students whose final score is ready for score statistics. */
  finalizedScoreCount: number;
  /** Number of students contributing a representative attempt to question statistics. */
  questionStatsStudentCount: number;
  statisticsScoreScaleVersion: number;
  scoreDistribution: ScoreDistributionBucket[];
  submissionBreakdown: ResultBreakdownItem[];
  passFailBreakdown: ResultBreakdownItem[];
}

export interface ExamResultSummary extends ExamResultStatsApi {
  id: string;
  examId: number;
  examName: string;
  subject: string;
  subjectId: string | null;
  date: string | null;
  endDate: string | null;
  duration: number | null;
  status: ExamResultStatus;
}

export interface ExamResultsOverview extends ExamResultStatsApi {
  examId: number;
  examName: string;
  subject: string;
  subjectId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ExamResultStatus;
}

export interface StudentAttemptSummary {
  attemptId: number;
  attemptNumber: number | null;
  score: number;
  gradingScale: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: string;
  status: "submitted" | "late" | "pending-grading";
  provisional: boolean;
  submittedAt: string | null;
}

export interface StudentResult {
  id: string;
  attemptId: number | null;
  studentId: string;
  name: string;
  score: number;
  gradingScale: number;
  passingScore: number;
  provisional: boolean;
  passed: boolean | null;
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
  attemptNumber: number | null;
  examName: string;
  studentId: string | null;
  studentName: string;
  score: number;
  rawEarnedScore: number;
  rawPossibleScore: number;
  gradingScale: number;
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
  selectionCount: number;
  percentage: number;
}

export interface ObjectiveResponseStats {
  correctCount: number;
  correctRate: number;
  incorrectCount: number;
  incorrectRate: number;
  unansweredCount: number;
  unansweredRate: number;
}

export interface EssayResponseStats {
  answeredCount: number;
  answeredRate: number;
  unansweredCount: number;
  unansweredRate: number;
  gradedCount: number;
  pendingGradingCount: number;
  /** Average awarded score / question maximum among already graded answers. */
  averageScoreRate: number | null;
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
  responseStats: ObjectiveResponseStats | null;
  essayStats: EssayResponseStats | null;
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
  finalScore: number | null;
  gradingScale: number;
}
