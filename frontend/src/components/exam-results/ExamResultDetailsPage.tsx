import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, EyeOff, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { studentResultService } from "../../services/student-result.service";
import type { StudentExamResult, StudentResultQuestion } from "../../types/student-result";

interface ExamResultDetailsPageProps {
  examId: string;
  onBack: () => void;
}

function isAnswered(question: StudentResultQuestion): boolean {
  return Boolean(question.studentAnswer?.trim());
}

function questionPoints(question: StudentResultQuestion): string {
  if (question.gradingStatus === "pending") return `Maximum: ${question.maxPoints} points`;
  return `Awarded: ${question.awardedPoints ?? 0} / ${question.maxPoints} points`;
}

export function ExamResultDetailsPage({ examId, onBack }: ExamResultDetailsPageProps) {
  const [exam, setExam] = useState<StudentExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setExam(await studentResultService.getDetail(Number(examId)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load exam result.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDetail(); }, [examId]);

  const answeredCount = useMemo(
    () => exam?.questions?.filter(isAnswered).length ?? null,
    [exam],
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-gray-600">Loading exam result...</p></div>;
  if (loadError || !exam) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Card className="max-w-md"><CardContent className="p-8 text-center space-y-4"><p className="text-red-600">{loadError || "Exam not found"}</p><div className="flex justify-center gap-2"><Button variant="outline" onClick={onBack}>Back to Results</Button><Button onClick={() => void loadDetail()}>Retry</Button></div></CardContent></Card></div>;

  const date = exam.date ? new Date(exam.date) : null;
  const displayDate = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Date unavailable";
  const isPending = exam.status === "pending";
  const canShowScore = exam.scoreVisible && exam.score !== null;
  const resultLabel = canShowScore && !isPending && exam.passingScore !== null
    ? exam.score >= exam.passingScore ? "Passed" : "Failed"
    : null;
  const hasAttemptNumber = typeof exam.attemptNumber === "number" && exam.attemptNumber > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50"><div className="container mx-auto px-4 py-6 max-w-5xl">
      <Button onClick={onBack} variant="outline" className="mb-6"><ArrowLeft className="size-4 mr-2" />Back to Results</Button>
      <div className="mb-6"><h1 className="text-3xl text-gray-800 mb-2">{exam.examTitle}</h1><p className="text-gray-600">{exam.subject}</p></div>
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200"><CardContent className="pt-6">
          {isPending ? <p className="text-xl text-yellow-800">Awaiting essay grading</p> : canShowScore ? <div><p className="text-sm text-gray-600 mb-1">Score</p><p className="text-4xl text-teal-700">{exam.score?.toFixed(2)} / 10</p><p className="text-sm text-gray-600">{exam.rawEarnedScore} / {exam.rawPossibleScore} raw points</p></div> : <p className="text-xl text-gray-700">Result is hidden by Teacher</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-teal-200">
            {canShowScore && <><div><p className="text-sm text-gray-600">Passing Score</p><p className="text-lg text-gray-800">{exam.passingScore !== null ? `${exam.passingScore.toFixed(2)} / 10` : "Not available"}</p></div><div><p className="text-sm text-gray-600">Result</p><p className={`text-lg ${resultLabel === "Passed" ? "text-green-700" : resultLabel === "Failed" ? "text-red-700" : "text-gray-700"}`}>{resultLabel ?? (isPending ? "Awaiting grading" : "Not available")}</p></div><div><p className="text-sm text-gray-600">Answered</p><p className="text-lg text-gray-800">{exam.allowViewDetails && answeredCount !== null ? `${answeredCount} / ${exam.totalQuestions} questions` : "Not available"}</p></div></>}
            <div><p className="text-sm text-gray-600">Time Taken</p><p className="text-lg text-gray-800 flex items-center gap-2"><Clock className="size-4" />{exam.timeTaken}</p></div>
            {hasAttemptNumber && <div><p className="text-sm text-gray-600">Attempt</p><p className="text-lg text-gray-800">{exam.maxAttempts ? `${exam.attemptNumber} / ${exam.maxAttempts}` : `#${exam.attemptNumber}`}</p></div>}
            <div><p className="text-sm text-gray-600">Exam Date</p><p className="text-lg text-gray-800 flex items-center gap-2"><Calendar className="size-4" />{displayDate}</p></div>
          </div>
        </CardContent></Card>
        {exam.terminated && <Card className="border-orange-200 bg-orange-50"><CardContent className="py-4 text-orange-800">This attempt was terminated. Result visibility rules still apply.</CardContent></Card>}
        {exam.allowViewDetails && exam.questions?.length ? <Card><CardContent className="pt-6"><h2 className="text-lg text-gray-800 mb-4">Questions Review</h2><div className="space-y-4">
          {exam.questions.map((question, index) => {
            const correctAnswers = question.correctAnswers ?? (question.correctAnswer ? [question.correctAnswer] : []);
            const isIncorrectMcq = question.type === "mcq" && question.gradingStatus === "graded" && !question.isCorrect;
            const essayClass = question.gradingStatus === "pending"
              ? "bg-amber-50 border-amber-200"
              : question.gradingStatus === "blank"
                ? "bg-slate-50 border-slate-200"
                : "bg-sky-50 border-sky-200";
            return <div key={question.id} className={`p-4 rounded-lg border ${question.type === "essay" ? essayClass : question.isCorrect ? "bg-green-50 border-green-200" : isIncorrectMcq ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
              <div className="flex justify-between gap-2"><p className="text-gray-800"><span className="font-medium">Q{index + 1}.</span> {question.question}</p><Badge variant="outline">{question.type === "essay" ? "Essay" : "MCQ"}</Badge></div>
              {question.type === "mcq" && <div className="mt-3 space-y-2">{question.options?.map((option) => {
                const isCorrect = correctAnswers.includes(option);
                const isStudentChoice = option === question.studentAnswer;
                const optionClass = isCorrect ? "bg-green-100 border-green-300 text-green-900" : isStudentChoice ? "bg-red-100 border-red-300 text-red-900" : isIncorrectMcq ? "bg-red-50 border-red-100" : "bg-white border-gray-200";
                return <div key={option} className={`p-2 border rounded text-sm flex justify-between ${optionClass}`}><span>{option}</span><span className="flex gap-3">{isStudentChoice && <span className="flex items-center gap-1 text-blue-700"><XCircle className="size-3" />Your Choice</span>}{isCorrect && <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="size-3" />Correct</span>}</span></div>;
              })}</div>}
              {question.type === "mcq" && !isAnswered(question) && <p className="mt-3 text-sm text-gray-600">No answer submitted</p>}
              {question.type === "essay" && <div className="mt-3"><p className="text-xs text-gray-600 mb-1">Your Answer</p><div className="p-3 border rounded text-sm whitespace-pre-wrap bg-white/70">{isAnswered(question) ? question.studentAnswer : "No answer submitted"}</div>{question.gradingStatus === "pending" && <p className="mt-2 text-sm text-amber-800">Awaiting grading</p>}</div>}
              <p className="mt-3 text-sm text-gray-700">{questionPoints(question)}</p>
            </div>;
          })}
        </div></CardContent></Card> : <Card className="bg-yellow-50 border-yellow-200"><CardContent className="py-8 flex justify-center gap-3 text-yellow-800"><EyeOff className="size-6" /><p>Review details are not available based on instructor settings.</p></CardContent></Card>}
      </div>
    </div></div>
  );
}
