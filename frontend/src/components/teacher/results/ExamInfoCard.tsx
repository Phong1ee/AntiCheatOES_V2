import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
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
} from 'lucide-react';

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
  onRefreshGrades,
  onManualGrading,
}: ExamInfoCardProps) {
  const completionRate = ((submittedCount / totalStudents) * 100).toFixed(1);
  const essayGradingRate = totalEssayCount > 0 
    ? (((totalEssayCount - pendingEssayCount) / totalEssayCount) * 100).toFixed(1)
    : 100;

  return (
    <Card className="shadow-md rounded-2xl border-0">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl text-gray-800 mb-2">{examName}</CardTitle>
            <Badge variant="outline" className="bg-teal-100 text-teal-700">
              <BookOpen className="size-3 mr-1" />
              {subject}
            </Badge>
          </div>
          <div className="flex gap-2">
            {onRefreshGrades && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshGrades}
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                <RefreshCw className="size-4 mr-2 text-blue-600" />
                Refresh Grades
              </Button>
            )}
            {onManualGrading && hasEssayQuestions && (
              <Button
                variant={pendingEssayCount > 0 ? "default" : "outline"}
                size="sm"
                onClick={onManualGrading}
                className={pendingEssayCount > 0 
                  ? "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700" 
                  : "hover:bg-purple-50 hover:border-purple-300"}
              >
                <PenLine className={`size-4 mr-2 ${pendingEssayCount > 0 ? 'text-white' : 'text-purple-600'}`} />
                {pendingEssayCount > 0 ? `Grade Essays (${pendingEssayCount} pending)` : 'Grade Essays'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-2 md:grid-cols-4 ${hasEssayQuestions ? 'lg:grid-cols-8' : 'lg:grid-cols-7'} gap-4`}>
          {/* Exam Period */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="size-4 text-blue-600" />
              <p className="text-xs text-blue-600">Exam Period</p>
            </div>
            <p className="text-sm text-gray-800">
              {new Date(startDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-gray-500">to</p>
            <p className="text-sm text-gray-800">
              {new Date(endDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Total Questions */}
          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <FileQuestion className="size-4 text-purple-600" />
              <p className="text-xs text-purple-600">Questions</p>
            </div>
            <p className="text-2xl text-gray-800">{totalQuestions}</p>
          </div>

          {/* Participants */}
          <div className="p-4 bg-gradient-to-br from-teal-50 to-green-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Users className="size-4 text-teal-600" />
              <p className="text-xs text-teal-600">Students</p>
            </div>
            <p className="text-2xl text-gray-800">{totalStudents}</p>
            <p className="text-xs text-gray-500">{submittedCount} submitted</p>
          </div>

          {/* Completion Rate */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="size-4 text-green-600" />
              <p className="text-xs text-green-600">Completion</p>
            </div>
            <p className="text-2xl text-gray-800">{completionRate}%</p>
          </div>

          {/* Average Score */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-amber-600" />
              <p className="text-xs text-amber-600">Average</p>
            </div>
            <p className="text-2xl text-gray-800">{avgScore}</p>
            <p className="text-xs text-gray-500">out of 100</p>
          </div>

          {/* Highest Score */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-green-600" />
              <p className="text-xs text-green-600">Highest</p>
            </div>
            <p className="text-2xl text-gray-800">{highestScore}</p>
          </div>

          {/* Lowest Score */}
          <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="size-4 text-red-600" />
              <p className="text-xs text-red-600">Lowest</p>
            </div>
            <p className="text-2xl text-gray-800">{lowestScore}</p>
          </div>

          {/* Essay Grading Status */}
          {hasEssayQuestions && (
            <div className={`p-4 rounded-xl ${
              pendingEssayCount > 0 
                ? 'bg-gradient-to-br from-amber-50 to-orange-50' 
                : 'bg-gradient-to-br from-purple-50 to-pink-50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <PenLine className={`size-4 ${pendingEssayCount > 0 ? 'text-amber-600' : 'text-purple-600'}`} />
                <p className={`text-xs ${pendingEssayCount > 0 ? 'text-amber-600' : 'text-purple-600'}`}>
                  Essay Grading
                </p>
              </div>
              <p className="text-2xl text-gray-800">{essayGradingRate}%</p>
              <p className="text-xs text-gray-500">
                {totalEssayCount - pendingEssayCount}/{totalEssayCount} graded
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}