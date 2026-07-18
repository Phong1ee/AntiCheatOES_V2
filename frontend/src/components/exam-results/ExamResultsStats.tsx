import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Trophy, TrendingUp, Target } from 'lucide-react';

// Định nghĩa type giống dữ liệu BE đang trả về trong ExamResults.tsx
interface ExamResult {
  id: string;
  examTitle: string;
  subject: string;
  date: string;
  duration: string;
  status: 'published' | 'pending' | 'hidden';
  score?: number;            // raw score (thường = số câu đúng)
  correctAnswers?: number;   // số câu đúng
  totalQuestions?: number;   // tổng số câu
  timeTaken?: string;
  scoreVisible: boolean;
  allowViewDetails: boolean;
}

interface ExamResultsStatsProps {
  results: ExamResult[];
}

export function ExamResultsStats({ results }: ExamResultsStatsProps) {
  const completedExams = results.length;
  const publishedExams = results.filter((r) => r.status === 'published').length;

  // Chỉ lấy những kết quả đã published VÀ được xem điểm
  const visibleResults = results.filter(
    (r) =>
      r.status === 'published' &&
      r.scoreVisible &&
      r.totalQuestions &&
      r.totalQuestions > 0 &&
      (r.correctAnswers ?? r.score) !== undefined
  );

  // Tính % điểm giống ExamResults.tsx
  const percentages = visibleResults.map((r) => {
    const correct = (r.correctAnswers ?? r.score)!;
    const total = r.totalQuestions!;
    return Math.min(100, Math.max(0, Math.round((correct / total) * 100)));
  });

  const averageScore =
    percentages.length > 0
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : 0;

  // Top scores theo %
  const topScores = visibleResults
    .map((r) => {
      const correct = (r.correctAnswers ?? r.score)!;
      const total = r.totalQuestions!;
      const percent = Math.min(100, Math.max(0, Math.round((correct / total) * 100)));
      return { ...r, percent };
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-teal-600';
    return 'text-yellow-600';
  };

  return (
    <div className="w-80 space-y-4">
      {/* Quick Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Target className="size-4 text-teal-600" />
            </div>
            Quick Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Completed Exams</span>
              <span className="text-gray-800">{completedExams}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Published Results</span>
              <span className="text-green-600">{publishedExams}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending Results</span>
              <span className="text-yellow-600">
                {results.filter((r) => r.status === 'pending').length}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Average Score</span>
              <span className={`text-2xl ${getScoreColor(averageScore)}`}>
                {averageScore}%
              </span>
            </div>
            <Progress value={averageScore} className="h-2" />
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Completion Rate</span>
              <span className="text-gray-800">
                {completedExams > 0
                  ? Math.round((publishedExams / completedExams) * 100)
                  : 0}
                %
              </span>
            </div>
            <Progress
              value={
                completedExams > 0 ? (publishedExams / completedExams) * 100 : 0
              }
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Top Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Trophy className="size-4 text-yellow-600" />
            </div>
            Top Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topScores.length > 0 ? (
            <div className="space-y-3">
              {topScores.map((exam, index) => (
                <div
                  key={exam.id}
                  className="flex items-start gap-3 p-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-100"
                >
                  <div
                    className={`flex items-center justify-center size-8 rounded-full text-white ${
                      index === 0
                        ? 'bg-yellow-500'
                        : index === 1
                        ? 'bg-gray-400'
                        : 'bg-orange-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      {exam.examTitle}
                    </p>
                    <p className="text-xs text-gray-600">{exam.subject}</p>
                  </div>
                  <span className={`text-lg ${getScoreColor(exam.percent)}`}>
                    {exam.percent}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 text-center py-4">
              No scores available yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="size-4 text-blue-600" />
            </div>
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-800">Excellent (90-100%)</span>
            <span className="text-green-600">
              {percentages.filter((s) => s >= 90).length}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-800">Good (80-89%)</span>
            <span className="text-blue-600">
              {percentages.filter((s) => s >= 80 && s < 90).length}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-200">
            <span className="text-sm text-teal-800">Fair (70-79%)</span>
            <span className="text-teal-600">
              {percentages.filter((s) => s >= 70 && s < 80).length}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <span className="text-sm text-yellow-800">Pass (60-69%)</span>
            <span className="text-yellow-600">
              {percentages.filter((s) => s >= 60 && s < 70).length}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <span className="text-sm text-red-800">Below Pass {'(<60%)'}</span>
            <span className="text-red-600">
              {percentages.filter((s) => s < 60).length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
