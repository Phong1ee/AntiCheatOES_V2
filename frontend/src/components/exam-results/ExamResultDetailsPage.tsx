import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  ArrowLeft,
  EyeOff,
  FileText,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

interface QuestionResult {
  id: number;
  type: "mcq" | "essay";
  topic?: string | null;
  isCorrect: boolean;
  question: string;
  options?: string[];
  studentAnswer?: string | null;
  correctAnswer?: string | null;
}

interface ExamResultDetail {
  id: string; // id của submission
  examTitle: string;
  subject: string;
  date: string;
  duration: string;
  timeTaken: string;
  scoreVisible: boolean;
  allowViewDetails: boolean;
  score?: number; // raw: số câu đúng (fallback)
  correctAnswers?: number; // số câu đúng
  totalQuestions?: number; // tổng số câu
  questions?: QuestionResult[];
}

interface ExamResultDetailsPageProps {
  examId: string; // thực chất là submissionId
  onBack: () => void;
}

export function ExamResultDetailsPage({
  examId,
  onBack,
}: ExamResultDetailsPageProps) {
  const [exam, setExam] = useState<ExamResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_BASE_URL}/api/results/${examId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load exam result");
        }

        const data = await res.json();

        const mapped: ExamResultDetail = {
          id: data.id,
          examTitle: data.examTitle,
          subject: data.subject,
          date: data.date,
          duration: data.duration,
          timeTaken: data.timeTaken,
          scoreVisible: data.scoreVisible,
          allowViewDetails: data.allowViewDetails,
          score: data.score,
          correctAnswers: data.correctAnswers,
          totalQuestions: data.totalQuestions,
          questions: data.questions || [],
        };

        setExam(mapped);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Error loading exam result");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [examId]);

  const getScoreColor = (percent: number) => {
    if (percent >= 90) return "text-green-600";
    if (percent >= 80) return "text-blue-600";
    if (percent >= 70) return "text-teal-600";
    if (percent >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreGrade = (percent: number) => {
    if (percent >= 90) return { grade: "A", color: "bg-green-500" };
    if (percent >= 80) return { grade: "B", color: "bg-blue-500" };
    if (percent >= 70) return { grade: "C", color: "bg-teal-500" };
    if (percent >= 60) return { grade: "D", color: "bg-yellow-500" };
    return { grade: "F", color: "bg-red-500" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-600">Loading exam result...</p>
      </div>
    );
  }

  if (loadError || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">{loadError || "Exam not found"}</p>
            <Button onClick={onBack} className="mt-4">
              <ArrowLeft className="size-4 mr-2" />
              Back to Results
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tính % giống ExamResults: correct / total * 100
  const rawCorrect = exam.correctAnswers ?? exam.score ?? 0;
  const total =
    exam.totalQuestions && exam.totalQuestions > 0
      ? exam.totalQuestions
      : undefined;
  const computedPercent =
    total !== undefined ? Math.round((rawCorrect / total) * 100) : undefined;

  const scorePercent =
    computedPercent !== undefined
      ? Math.min(100, Math.max(0, computedPercent))
      : undefined;

  const scoreGrade =
    scorePercent !== undefined && exam.scoreVisible
      ? getScoreGrade(scorePercent)
      : null;

  const topicPerformance =
    exam.questions && exam.questions.length > 0
      ? exam.questions.reduce((acc, q) => {
          const topic = q.topic || "General";
          if (!acc[topic]) {
            acc[topic] = { correct: 0, total: 0 };
          }
          acc[topic].total++;
          if (q.isCorrect) acc[topic].correct++;
          return acc;
        }, {} as Record<string, { correct: number; total: number }>)
      : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Back Button */}
        <Button onClick={onBack} variant="outline" className="mb-6">
          <ArrowLeft className="size-4 mr-2" />
          Back to Results
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-800 mb-2">{exam.examTitle}</h1>
          <p className="text-gray-600">{exam.subject}</p>
        </div>

        <div className="space-y-6">
          {/* Score summary */}
          <Card className="bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Your Score</p>
                  <div className="flex items-center gap-3">
                    {exam.scoreVisible && scorePercent !== undefined ? (
                      <>
                        <span
                          className={`text-4xl ${getScoreColor(scorePercent)}`}
                        >
                          {scorePercent}%
                        </span>
                        {scoreGrade && (
                          <div
                            className={`${scoreGrade.color} text-white rounded-lg px-4 py-2`}
                          >
                            <span className="text-2xl">
                              Grade {scoreGrade.grade}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-700">
                        Score is hidden by instructor.
                      </span>
                    )}
                  </div>
                </div>
                {exam.scoreVisible && scorePercent !== undefined && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Performance</p>
                    <Progress value={scorePercent} className="w-32 h-3 mt-2" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-teal-200">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Correct Answers</p>
                  <p className="text-xl text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="size-5" />
                    {exam.scoreVisible &&
                    exam.correctAnswers !== undefined &&
                    exam.totalQuestions !== undefined
                      ? `${exam.correctAnswers}/${exam.totalQuestions}`
                      : "Hidden"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Time Taken</p>
                  <p className="text-xl text-gray-800 flex items-center gap-2">
                    <Clock className="size-5" />
                    {exam.timeTaken}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Exam Date</p>
                  <p className="text-xl text-gray-800 flex items-center gap-2">
                    <Calendar className="size-5" />
                    {new Date(exam.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic performance */}
          {exam.scoreVisible && Object.keys(topicPerformance).length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="size-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg text-gray-800">
                    Performance by Topic
                  </h3>
                </div>

                <div className="space-y-3">
                  {Object.entries(topicPerformance).map(([topic, stats]) => {
                    const percentage = Math.round(
                      (stats.correct / stats.total) * 100
                    );
                    return (
                      <div key={topic}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">{topic}</span>
                          <span className="text-sm text-gray-600">
                            {stats.correct}/{stats.total} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Questions review */}
          {exam.allowViewDetails &&
          exam.questions &&
          exam.questions.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Target className="size-5 text-teal-600" />
                  </div>
                  <h3 className="text-lg text-gray-800">Questions Review</h3>
                </div>

                <div className="space-y-4">
                  {exam.questions.map((question, index) => (
                    <div key={question.id}>
                      {question.type === "mcq" ? (
                        <div
                          className={`p-4 rounded-lg border ${
                            question.isCorrect
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                Q{index + 1}.
                              </span>
                              <p className="text-gray-800">
                                {question.question}
                              </p>
                            </div>
                            {question.topic && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-white"
                              >
                                {question.topic}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-3 space-y-2">
                            {question.options?.map((option, optIndex) => {
                              const isStudentChoice =
                                option === question.studentAnswer;
                              const isCorrectChoice =
                                option === question.correctAnswer;

                              let optionClasses =
                                "w-full text-left px-3 py-2 rounded-md border text-sm flex items-center justify-between";
                              if (isCorrectChoice) {
                                optionClasses +=
                                  " border-green-300 bg-green-50 text-green-800";
                              } else if (isStudentChoice && !isCorrectChoice) {
                                optionClasses +=
                                  " border-red-300 bg-red-50 text-red-800";
                              } else {
                                optionClasses +=
                                  " border-gray-200 bg-white text-gray-700";
                              }

                              return (
                                <button
                                  key={optIndex}
                                  type="button"
                                  className={optionClasses}
                                  disabled
                                >
                                  <span>{option}</span>
                                  <span className="flex items-center gap-2 text-xs">
                                    {/* 1. User chọn đúng → CHỈ hiện "Your Choice" màu xanh */}
                                    {isStudentChoice && isCorrectChoice && (
                                      <span className="flex items-center gap-1 text-green-700">
                                        <CheckCircle2 className="size-3" />
                                        Your Choice
                                      </span>
                                    )}

                                    {/* 2. Đáp án đúng nhưng user KHÔNG chọn → hiện "Correct" */}
                                    {!isStudentChoice && isCorrectChoice && (
                                      <span className="flex items-center gap-1 text-green-700">
                                        <CheckCircle2 className="size-3" />
                                        Correct
                                      </span>
                                    )}

                                    {/* 3. User chọn sai → hiện "Your Choice" màu đỏ */}
                                    {isStudentChoice && !isCorrectChoice && (
                                      <span className="flex items-center gap-1 text-red-700">
                                        <XCircle className="size-3" />
                                        Your Choice
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`p-4 rounded-lg border ${
                            question.isCorrect
                              ? "bg-green-50 border-green-200"
                              : "bg-yellow-50 border-yellow-200"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                Q{index + 1}.
                              </span>
                              <p className="text-gray-800">
                                {question.question}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs bg-white flex items-center gap-1"
                            >
                              <FileText className="size-3" />
                              Essay
                            </Badge>
                          </div>

                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-1">
                                Your Answer
                              </p>
                              <div className="p-3 rounded-md bg-white border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap">
                                {question.studentAnswer ||
                                  "No answer provided."}
                              </div>
                            </div>
                            {question.correctAnswer && (
                              <div>
                                <p className="text-xs font-medium text-gray-600 mb-1">
                                  Model Answer
                                </p>
                                <div className="p-3 rounded-md bg-white border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap">
                                  {question.correctAnswer}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-3 text-yellow-800">
                  <EyeOff className="size-6" />
                  <p>
                    Review details are not available based on instructor
                    settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
