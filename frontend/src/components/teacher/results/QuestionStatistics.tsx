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

interface QuestionStat {
  questionNumber: number;
  type: 'mcq' | 'true-false' | 'essay';
  difficulty: 'easy' | 'medium' | 'hard';
  correctRate: number;
  totalAttempts: number;
  optionStats?: {
    option: string;
    percentage: number;
  }[];
}

const mockStats: QuestionStat[] = [
  {
    questionNumber: 1,
    type: 'mcq',
    difficulty: 'medium',
    correctRate: 85,
    totalAttempts: 20,
    optionStats: [
      { option: 'A', percentage: 85 },
      { option: 'B', percentage: 10 },
      { option: 'C', percentage: 5 },
      { option: 'D', percentage: 0 },
    ],
  },
  {
    questionNumber: 2,
    type: 'true-false',
    difficulty: 'easy',
    correctRate: 95,
    totalAttempts: 20,
    optionStats: [
      { option: 'True', percentage: 5 },
      { option: 'False', percentage: 95 },
    ],
  },
  {
    questionNumber: 3,
    type: 'mcq',
    difficulty: 'hard',
    correctRate: 45,
    totalAttempts: 20,
    optionStats: [
      { option: 'A', percentage: 45 },
      { option: 'B', percentage: 30 },
      { option: 'C', percentage: 20 },
      { option: 'D', percentage: 5 },
    ],
  },
  {
    questionNumber: 4,
    type: 'essay',
    difficulty: 'hard',
    correctRate: 70,
    totalAttempts: 20,
  },
  {
    questionNumber: 5,
    type: 'mcq',
    difficulty: 'medium',
    correctRate: 75,
    totalAttempts: 19, // One student skipped
    optionStats: [
      { option: 'A', percentage: 75 },
      { option: 'B', percentage: 15 },
      { option: 'C', percentage: 5 },
      { option: 'D', percentage: 5 },
    ],
  },
];

const typeConfig = {
  mcq: { icon: CheckSquare, label: 'MCQ', color: 'bg-blue-100 text-blue-700' },
  'true-false': { icon: Circle, label: 'T/F', color: 'bg-purple-100 text-purple-700' },
  essay: { icon: FileText, label: 'Essay', color: 'bg-amber-100 text-amber-700' },
};

const difficultyConfig = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
};

export function QuestionStatistics() {
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
              {mockStats.map((stat) => {
                const typeInfo = typeConfig[stat.type];
                const TypeIcon = typeInfo.icon;
                const difficultyInfo = difficultyConfig[stat.difficulty];

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
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <p className="text-sm text-green-600 mb-1">High Performance</p>
            <p className="text-2xl text-green-700">
              {mockStats.filter((s) => s.correctRate >= 80).length}
            </p>
            <p className="text-xs text-gray-500">Questions with ≥80% correct</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm text-amber-600 mb-1">Moderate Performance</p>
            <p className="text-2xl text-amber-700">
              {mockStats.filter((s) => s.correctRate >= 60 && s.correctRate < 80).length}
            </p>
            <p className="text-xs text-gray-500">Questions with 60-79% correct</p>
          </div>
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm text-red-600 mb-1">Needs Review</p>
            <p className="text-2xl text-red-700">
              {mockStats.filter((s) => s.correctRate < 60).length}
            </p>
            <p className="text-xs text-gray-500">Questions with {'<'}60% correct</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Questions with low correct rates may need to be reviewed
            for clarity or difficulty level. Consider revising questions with less than 60%
            correct rate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}