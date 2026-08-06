import { Button } from '../../ui/button';
import {
  BookOpen,
  Calendar,
  Users,
  FileQuestion,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  RefreshCw,
  PenLine,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import type { ResultStrategy } from '../../../types/teacher-results';

const STRATEGY_LABELS: Record<ResultStrategy, string> = {
  highest: 'Highest Attempt',
  average: 'Average of Attempts',
  last_attempt: 'Last Attempt',
};

interface ExamInfoCardProps {
  examName: string;
  subject: string;
  startDate: string;
  endDate: string;
  totalQuestions: number;
  totalStudents: number;
  submittedCount: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  hasEssayQuestions?: boolean;
  pendingEssayCount?: number;
  totalEssayCount?: number;
  resultStrategy?: ResultStrategy;
  onRefreshGrades?: () => void;
  onManualGrading?: () => void;
}

export function ExamInfoCard({
  examName,
  subject,
  startDate,
  endDate,
  totalQuestions,
  totalStudents,
  submittedCount,
  avgScore,
  highestScore,
  lowestScore,
  hasEssayQuestions = false,
  pendingEssayCount = 0,
  totalEssayCount = 0,
  resultStrategy,
  onRefreshGrades,
  onManualGrading,
}: ExamInfoCardProps) {
  const completionRate = ((submittedCount / totalStudents) * 100).toFixed(1);
  const essayGradingRate =
    totalEssayCount > 0
      ? (((totalEssayCount - pendingEssayCount) / totalEssayCount) * 100).toFixed(1)
      : '100';

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-blue-600 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-xl font-semibold leading-snug">{examName}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/20 text-white px-3 py-1 rounded-full backdrop-blur-sm">
                <BookOpen className="size-3.5" />
                {subject}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/20 text-white px-3 py-1 rounded-full backdrop-blur-sm">
                <Calendar className="size-3.5" />
                {fmt(startDate)} – {fmt(endDate)}
              </span>
              {resultStrategy && (
                <span className="inline-flex items-center gap-1.5 text-sm bg-white/20 text-white px-3 py-1 rounded-full backdrop-blur-sm">
                  <SlidersHorizontal className="size-3.5" />
                  {STRATEGY_LABELS[resultStrategy]}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onRefreshGrades && (
              <Button
                size="sm"
                onClick={onRefreshGrades}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              >
                <RefreshCw className="size-4 mr-1.5" />
                Refresh
              </Button>
            )}
            {onManualGrading && hasEssayQuestions && (
              <Button
                size="sm"
                onClick={onManualGrading}
                className={
                  pendingEssayCount > 0
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-900 border-0'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm'
                }
              >
                {pendingEssayCount > 0 && <AlertTriangle className="size-4 mr-1.5" />}
                <PenLine className="size-4 mr-1.5" />
                Grade Essays
                {pendingEssayCount > 0 && (
                  <span className="ml-1.5 bg-amber-900/20 px-1.5 py-0.5 rounded-full text-xs">
                    {pendingEssayCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="bg-white grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
        {/* Questions */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <FileQuestion className="size-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Questions</p>
            <p className="text-2xl font-semibold text-gray-800 leading-none mt-0.5">{totalQuestions}</p>
          </div>
        </div>

        {/* Students */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Users className="size-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Students</p>
            <p className="text-2xl font-semibold text-gray-800 leading-none mt-0.5">{totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">{submittedCount} submitted</p>
          </div>
        </div>

        {/* Completion */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="size-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Completion</p>
            <p className="text-2xl font-semibold text-gray-800 leading-none mt-0.5">{completionRate}%</p>
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Average */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="size-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Average Score</p>
            <p className="text-2xl font-semibold text-gray-800 leading-none mt-0.5">{avgScore.toFixed(2)} / 100</p>
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                style={{ width: `${Math.min(avgScore, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Highest */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Award className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Highest Score</p>
            <p className="text-2xl font-semibold text-blue-700 leading-none mt-0.5">{highestScore.toFixed(2)} / 100</p>
          </div>
        </div>

        {/* Lowest */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Clock className="size-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Lowest Score</p>
            <p className="text-2xl font-semibold text-red-600 leading-none mt-0.5">{lowestScore.toFixed(2)} / 100</p>
          </div>
        </div>

        {/* Essay grading — only if applicable */}
        {hasEssayQuestions && (
          <div className="flex items-center gap-4 px-5 py-4 md:col-span-2">
            <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pendingEssayCount > 0 ? 'bg-amber-100' : 'bg-purple-100'}`}>
              <PenLine className={`size-5 ${pendingEssayCount > 0 ? 'text-amber-600' : 'text-purple-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Essay Grading</p>
                {pendingEssayCount > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {pendingEssayCount} pending
                  </span>
                )}
              </div>
              <p className={`text-2xl font-semibold leading-none mt-0.5 ${pendingEssayCount > 0 ? 'text-amber-600' : 'text-purple-600'}`}>
                {essayGradingRate}%
              </p>
              <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${pendingEssayCount > 0 ? 'from-amber-400 to-amber-500' : 'from-purple-400 to-purple-500'}`}
                  style={{ width: `${essayGradingRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalEssayCount - pendingEssayCount}/{totalEssayCount} graded
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
