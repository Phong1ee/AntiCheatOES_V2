import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Clock, EyeOff, ListChecks, RefreshCw, Target, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { studentResultService } from "../../services/student-result.service";
import type { StudentExamResult, StudentResultQuestion } from "../../types/student-result";

interface ExamResultDetailsPageProps {
  attemptId: number;
  onBack: () => void;
}

function isAnswered(question: StudentResultQuestion): boolean {
  return Boolean(question.studentAnswer?.trim());
}

function questionPoints(question: StudentResultQuestion): string {
  if (question.gradingStatus === "pending") return `Maximum: ${question.maxPoints} points`;
  return `Awarded: ${question.awardedPoints ?? 0} / ${question.maxPoints} points`;
}

interface StatAccent {
  border: string;
  iconBg: string;
  iconText: string;
}

function StatTile({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent: StatAccent }) {
  return (
    <div className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-xl border ${accent.border} bg-white/70 p-3`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent.iconBg} ${accent.iconText}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

const RESULT_THEME = {
  pending: {
    card: "border-amber-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 via-white to-white",
    score: "text-amber-700",
    accent: { border: "border-amber-200", iconBg: "bg-amber-100", iconText: "text-amber-700" },
  },
  passed: {
    card: "border-green-200 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 via-white to-white",
    score: "text-green-700",
    accent: { border: "border-green-200", iconBg: "bg-green-100", iconText: "text-green-700" },
  },
  failed: {
    card: "border-red-200 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 via-white to-white",
    score: "text-red-700",
    accent: { border: "border-red-200", iconBg: "bg-red-100", iconText: "text-red-700" },
  },
  neutral: {
    card: "border-slate-200 border-l-4 border-l-slate-400 bg-gradient-to-br from-slate-50 via-white to-white",
    score: "text-slate-700",
    accent: { border: "border-slate-200", iconBg: "bg-slate-100", iconText: "text-slate-700" },
  },
} as const;

export function ExamResultDetailsPage({ attemptId, onBack }: ExamResultDetailsPageProps) {
  const [exam, setExam] = useState<StudentExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setExam(await studentResultService.getDetail(attemptId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load exam result.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDetail(); }, [attemptId]);

  const answeredCount = useMemo(
    () => exam?.questions?.filter(isAnswered).length ?? null,
    [exam],
  );

  if (loading) return <div className="py-16 text-center"><p className="text-gray-600">Loading exam result...</p></div>;
  if (loadError || !exam) return <Card className="mx-auto max-w-md"><CardContent className="p-8 text-center space-y-4"><p className="text-red-600">{loadError || "Exam not found"}</p><div className="flex justify-center gap-2"><Button variant="outline" onClick={onBack}>Back to Results</Button><Button onClick={() => void loadDetail()}>Retry</Button></div></CardContent></Card>;

  const date = exam.date ? new Date(exam.date) : null;
  const displayDate = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Date unavailable";
  const isPending = exam.status === "pending";
  const canShowScore = exam.scoreVisible && exam.score !== null;
  const resultLabel = canShowScore && !isPending && exam.passingScore !== null
    ? exam.score >= exam.passingScore ? "Passed" : "Failed"
    : null;
  const hasAttemptNumber = typeof exam.attemptNumber === "number" && exam.attemptNumber > 0;
  const theme = isPending
    ? RESULT_THEME.pending
    : resultLabel === "Passed"
      ? RESULT_THEME.passed
      : resultLabel === "Failed"
        ? RESULT_THEME.failed
        : RESULT_THEME.neutral;

  return (
    <div className="mx-auto max-w-5xl">
      <Button onClick={onBack} variant="outline" className="mb-6"><ArrowLeft className="size-4 mr-2" />Back to Attempts</Button>
      <div className="space-y-6">
        <Card className={theme.card}>
          <CardContent className="space-y-5 pt-6">
            <div className={`border-b pb-4 ${theme.accent.border}`}>
              <h2 className="text-xl font-bold text-gray-900">{exam.examTitle}</h2>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-gray-700">
                <BookOpen className="size-3.5" />
                {exam.subject}
              </span>
            </div>
            {isPending ? (
              <p className="text-xl text-yellow-800">Awaiting essay grading</p>
            ) : canShowScore ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Score</p>
                  <p className={`text-4xl ${theme.score}`}>
                    {exam.score?.toFixed(2)} <span className="text-2xl opacity-70">/ 100</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{exam.rawEarnedScore} / {exam.rawPossibleScore} raw points</p>
                </div>
                {resultLabel && (
                  <Badge
                    className={`w-fit gap-1.5 px-3 py-1.5 text-sm ${
                      resultLabel === "Passed"
                        ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                        : "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {resultLabel === "Passed" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                    {resultLabel}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-xl text-gray-700">Result is hidden by Teacher</p>
            )}

            <div className={`flex flex-wrap gap-3 border-t pt-4 ${theme.accent.border}`}>
              {canShowScore && (
                <>
                  <StatTile
                    icon={Target}
                    label="Passing Score"
                    value={exam.passingScore !== null ? `${exam.passingScore.toFixed(2)} / 100` : "Not available"}
                    accent={theme.accent}
                  />
                  <StatTile
                    icon={ListChecks}
                    label="Answered"
                    value={exam.allowViewDetails && answeredCount !== null ? `${answeredCount} / ${exam.totalQuestions} questions` : "Not available"}
                    accent={theme.accent}
                  />
                </>
              )}
              <StatTile icon={Clock} label="Time Taken" value={exam.timeTaken} accent={theme.accent} />
              {hasAttemptNumber && (
                <StatTile
                  icon={RefreshCw}
                  label="Attempt"
                  value={exam.maxAttempts ? `${exam.attemptNumber} / ${exam.maxAttempts}` : `#${exam.attemptNumber}`}
                  accent={theme.accent}
                />
              )}
              <StatTile icon={Calendar} label="Exam Date" value={displayDate} accent={theme.accent} />
            </div>
          </CardContent>
        </Card>
        {exam.terminated && <Card className="border-orange-200 bg-orange-50"><CardContent className="py-4 text-orange-800">This attempt was terminated. Result visibility rules still apply.</CardContent></Card>}
        {exam.allowViewDetails && exam.questions?.length ? <Card><CardContent className="pt-6"><h2 className="text-lg text-gray-800 mb-4">Questions Review</h2><div className="space-y-4">
          {exam.questions.map((question, index) => {
            const correctAnswers = question.correctAnswers ?? (question.correctAnswer ? [question.correctAnswer] : []);
            const answeredWrongMcq = question.type === "mcq" && question.gradingStatus === "graded" && !question.isCorrect && isAnswered(question);
            const essayClass = question.gradingStatus === "pending"
              ? "bg-amber-50 border-amber-200"
              : question.gradingStatus === "blank"
                ? "bg-slate-50 border-slate-200"
                : "bg-sky-50 border-sky-200";
            return <div key={question.id} className={`p-4 rounded-lg border ${question.type === "essay" ? essayClass : question.isCorrect ? "bg-green-50 border-green-200" : answeredWrongMcq ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
              <div className="flex justify-between gap-2"><p className="text-gray-800"><span className="font-medium">Q{index + 1}.</span> {question.question}</p><Badge variant="outline">{question.type === "essay" ? "Essay" : "MCQ"}</Badge></div>
              {question.type === "mcq" && <div className="mt-3 space-y-2">{question.options?.map((option) => {
                const isCorrect = correctAnswers.includes(option);
                const isStudentChoice = option === question.studentAnswer;
                const optionClass = isCorrect ? "bg-green-100 border-green-300 text-green-900" : isStudentChoice ? "bg-red-100 border-red-300 text-red-900" : "bg-white border-gray-200";
                return <div key={option} className={`p-2 border rounded text-sm flex justify-between ${optionClass}`}><span>{option}</span><span className="flex gap-3">{isStudentChoice && <span className="flex items-center gap-1 text-red-700"><XCircle className="size-3" />Your Choice</span>}{isCorrect && <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="size-3" />Correct</span>}</span></div>;
              })}</div>}
              {question.type === "mcq" && !isAnswered(question) && <p className="mt-3 text-sm text-gray-600">No answer submitted</p>}
              {question.type === "essay" && <div className="mt-3"><p className="text-xs text-gray-600 mb-1">Your Answer</p><div className="p-3 border rounded text-sm whitespace-pre-wrap bg-white/70">{isAnswered(question) ? question.studentAnswer : "No answer submitted"}</div>{question.gradingStatus === "pending" && <p className="mt-2 text-sm text-amber-800">Awaiting grading</p>}</div>}
              <p className="mt-3 text-sm text-gray-700">{questionPoints(question)}</p>
            </div>;
          })}
        </div></CardContent></Card> : <Card className="bg-yellow-50 border-yellow-200"><CardContent className="py-8 flex justify-center gap-3 text-yellow-800"><EyeOff className="size-6" /><p>Review details are not available based on instructor settings.</p></CardContent></Card>}
      </div>
    </div>
  );
}
