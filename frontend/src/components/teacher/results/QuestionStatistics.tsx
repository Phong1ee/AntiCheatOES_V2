import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  CheckSquare,
  Circle,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Minus,
} from 'lucide-react';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { QuestionStat } from '../../../types/teacher-results';
import { LoadingState } from '../common/LoadingState';

const typeConfig = {
  mcq: { icon: CheckSquare, label: 'MCQ', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'true-false': { icon: Circle, label: 'True / False', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  essay: { icon: FileText, label: 'Essay', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const difficultyConfig: Record<string, { label: string; color: string; bar: string }> = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700 border-green-200', bar: 'border-l-green-400' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'border-l-amber-400' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700 border-red-200', bar: 'border-l-red-400' },
};

function correctRateColor(rate: number) {
  if (rate >= 80) return { text: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-200', bar: 'from-green-400 to-green-600' };
  if (rate >= 60) return { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200', bar: 'from-amber-400 to-amber-500' };
  return { text: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200', bar: 'from-red-400 to-red-500' };
}

function PerformanceLabel({ rate }: { rate: number }) {
  if (rate >= 80)
    return <span className="inline-flex items-center gap-1 text-xs text-green-600"><TrendingUp className="size-3" /> Good</span>;
  if (rate >= 60)
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Minus className="size-3" /> Fair</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-600"><TrendingDown className="size-3" /> Needs Review</span>;
}

function QuestionCard({ stat }: { stat: QuestionStat }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = typeConfig[stat.type];
  const TypeIcon = typeInfo.icon;
  const diffInfo = difficultyConfig[stat.difficulty] ?? difficultyConfig.medium;
  const rateColor = correctRateColor(stat.correctRate);

  return (
    <div className={`rounded-xl border-l-4 ${diffInfo.bar} bg-white shadow-sm overflow-hidden`}>
      {/* Header row — always visible */}
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Q number */}
        <div className={`size-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ring-2 ${rateColor.ring} ${rateColor.bg} ${rateColor.text}`}>
          {stat.questionNumber}
        </div>

        {/* Question text */}
        <p className="flex-1 text-sm text-gray-800 text-left line-clamp-1">{stat.questionText}</p>

        {/* Badges */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
            <TypeIcon className="size-3 mr-1" />
            {typeInfo.label}
          </Badge>
          <Badge variant="outline" className={`text-xs ${diffInfo.color}`}>
            {diffInfo.label}
          </Badge>
        </div>

        {/* Correct rate */}
        <div className={`text-right flex-shrink-0 w-16 ${rateColor.text}`}>
          <p className="text-lg font-semibold leading-none">{stat.correctRate}%</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{stat.totalAttempts} attempts</p>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {/* Full question text */}
          <p className="text-sm text-gray-700">{stat.questionText}</p>

          {/* Correct rate bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">Correct rate</span>
              <span className={`text-sm font-medium ${rateColor.text}`}>{stat.correctRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${rateColor.bar} rounded-full transition-all`}
                style={{ width: `${stat.correctRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <PerformanceLabel rate={stat.correctRate} />
              <span className="text-xs text-gray-400">{stat.totalAttempts} students attempted</span>
            </div>
          </div>

          {/* Option distribution */}
          {stat.optionStats ? (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Answer Distribution</p>
              {stat.optionStats.map((opt) => (
                <div key={opt.option} className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className={`inline-flex items-center justify-center size-5 rounded text-xs font-semibold flex-shrink-0 mt-0.5 ${
                        opt.isCorrect ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {opt.option}
                      </span>
                      <span className={`text-sm break-words leading-snug ${opt.isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                        {opt.label}
                        {opt.isCorrect && <span className="ml-1.5 text-xs text-green-500">(correct)</span>}
                      </span>
                    </div>
                    <span className={`text-sm font-medium flex-shrink-0 ${opt.isCorrect ? 'text-green-600' : 'text-gray-500'}`}>
                      {opt.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-7">
                    <div
                      className={`h-full rounded-full transition-all ${
                        opt.isCorrect
                          ? 'bg-gradient-to-r from-green-400 to-green-500'
                          : opt.percentage >= 25
                          ? 'bg-gradient-to-r from-blue-300 to-blue-400'
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <FileText className="size-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">Essay question — manually graded. Average score: {stat.correctRate}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QuestionStatisticsProps {
  examId: number;
  refreshKey: number;
}

export function QuestionStatistics({ examId, refreshKey }: QuestionStatisticsProps) {
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService
      .getStatistics(examId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load question statistics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, refreshKey]);

  if (loading) {
    return (
      <Card className="shadow-md rounded-2xl border-0">
        <CardContent className="p-12">
          <LoadingState variant="inline" label="Loading question statistics..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md rounded-2xl border-0">
        <CardContent className="p-12 text-center text-red-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-gray-800">Question Statistics</CardTitle>
        <p className="text-sm text-gray-600 mt-1">Click a question to see the full answer distribution</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((stat) => (
          <QuestionCard key={stat.questionNumber} stat={stat} />
        ))}

        {stats.length === 0 && (
          <p className="text-center text-gray-500 py-8">No questions found for this exam.</p>
        )}

        {stats.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm text-green-600 mb-1">High Performance</p>
                <p className="text-2xl text-green-700">{stats.filter((s) => s.correctRate >= 80).length}</p>
                <p className="text-xs text-gray-500">Questions with ≥80% correct</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-600 mb-1">Moderate Performance</p>
                <p className="text-2xl text-amber-700">{stats.filter((s) => s.correctRate >= 60 && s.correctRate < 80).length}</p>
                <p className="text-xs text-gray-500">Questions with 60–79% correct</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-sm text-red-600 mb-1">Needs Review</p>
                <p className="text-2xl text-red-700">{stats.filter((s) => s.correctRate < 60).length}</p>
                <p className="text-xs text-gray-500">Questions with &lt;60% correct</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Questions with low correct rates may need to be reviewed for clarity or difficulty. Consider revising questions below 60%.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
