import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { CheckSquare, Circle, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { QuestionStat } from '../../../types/teacher-results';

const typeConfig = {
  mcq: { icon: CheckSquare, label: 'MCQ', color: 'bg-blue-100 text-blue-700' },
  'true-false': { icon: Circle, label: 'T/F', color: 'bg-purple-100 text-purple-700' },
  essay: { icon: FileText, label: 'Essay', color: 'bg-amber-100 text-amber-700' },
};

const difficultyConfig: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
};

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
        <CardContent className="p-12 text-center text-gray-500">Loading question statistics...</CardContent>
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
        <p className="text-sm text-gray-600 mt-1">
          Analyze performance metrics for each question
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-center">Q#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-center">Correct Rate</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead>Answer Distribution</TableHead>
                <TableHead className="text-center">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((stat) => {
                const typeInfo = typeConfig[stat.type];
                const TypeIcon = typeInfo.icon;
                const difficultyInfo = difficultyConfig[stat.difficulty] ?? difficultyConfig.medium;

                return (
                  <TableRow key={stat.questionNumber} className="hover:bg-gray-50">
                    {/* Question Number */}
                    <TableCell className="text-center">
                      <Badge variant="outline">Q{stat.questionNumber}</Badge>
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Badge variant="outline" className={typeInfo.color}>
                        <TypeIcon className="size-3 mr-1" />
                        {typeInfo.label}
                      </Badge>
                    </TableCell>

                    {/* Difficulty */}
                    <TableCell>
                      <Badge variant="outline" className={difficultyInfo.color}>
                        {difficultyInfo.label}
                      </Badge>
                    </TableCell>

                    {/* Correct Rate */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`text-lg ${
                            stat.correctRate >= 80
                              ? 'text-green-700'
                              : stat.correctRate >= 60
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {stat.correctRate}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Attempts */}
                    <TableCell className="text-center text-gray-600">
                      {stat.totalAttempts}
                    </TableCell>

                    {/* Answer Distribution */}
                    <TableCell>
                      {stat.optionStats ? (
                        <div className="space-y-1 min-w-[200px]">
                          {stat.optionStats.map((opt) => (
                            <div key={opt.option} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-12">
                                {opt.option}:
                              </span>
                              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full flex items-center justify-end px-2 text-xs text-white transition-all ${
                                    opt.percentage >= 50
                                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                                      : opt.percentage >= 25
                                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                  }`}
                                  style={{ width: `${opt.percentage}%` }}
                                >
                                  {opt.percentage > 15 && `${opt.percentage}%`}
                                </div>
                              </div>
                              {opt.percentage <= 15 && (
                                <span className="text-xs text-gray-500 w-10">
                                  {opt.percentage}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Manual grading</span>
                      )}
                    </TableCell>

                    {/* Performance Indicator */}
                    <TableCell className="text-center">
                      {stat.correctRate >= 80 ? (
                        <div className="flex items-center justify-center gap-1 text-green-600">
                          <TrendingUp className="size-4" />
                          <span className="text-xs">Good</span>
                        </div>
                      ) : stat.correctRate >= 60 ? (
                        <div className="flex items-center justify-center gap-1 text-amber-600">
                          <span className="text-xs">Fair</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-red-600">
                          <TrendingDown className="size-4" />
                          <span className="text-xs">Needs Review</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No questions found for this exam.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {stats.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-green-600 mb-1">High Performance</p>
              <p className="text-2xl text-green-700">
                {stats.filter((s) => s.correctRate >= 80).length}
              </p>
              <p className="text-xs text-gray-500">Questions with ≥80% correct</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-amber-600 mb-1">Moderate Performance</p>
              <p className="text-2xl text-amber-700">
                {stats.filter((s) => s.correctRate >= 60 && s.correctRate < 80).length}
              </p>
              <p className="text-xs text-gray-500">Questions with 60-79% correct</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm text-red-600 mb-1">Needs Review</p>
              <p className="text-2xl text-red-700">
                {stats.filter((s) => s.correctRate < 60).length}
              </p>
              <p className="text-xs text-gray-500">Questions with {'<'}60% correct</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
