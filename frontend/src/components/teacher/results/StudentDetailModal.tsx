import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Progress } from '../../ui/progress';
import {
  X,
  User,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  Star,
  TrendingUp,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { teacherResultsService, downloadCsv } from '../../../services/teacher-results.service';
import type { StudentAttemptDetail } from '../../../types/teacher-results';
import { LoadingState } from '../common/LoadingState';

interface StudentDetailModalProps {
  examId: number;
  attemptId: number;
  onClose: () => void;
}

export function StudentDetailModal({ examId, attemptId, onClose }: StudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState('answers');
  const [attempt, setAttempt] = useState<StudentAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService
      .getAttemptDetail(examId, attemptId)
      .then((data) => {
        if (!cancelled) setAttempt(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load attempt details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, attemptId]);

  if (loading || error || !attempt) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center">
          {loading && <LoadingState variant="inline" label="Loading attempt details..." />}
          {!loading && error && <p className="text-red-600">{error}</p>}
          <Button variant="outline" onClick={onClose} className="mt-6">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const correctCount = attempt.questions.filter((q) => q.isCorrect === true).length;
  const incorrectCount = attempt.questions.filter((q) => q.isCorrect === false).length;
  const skippedCount = attempt.questions.filter((q) => q.isCorrect === null).length;
  const correctPercentage = attempt.totalQuestions > 0 ? (correctCount / attempt.totalQuestions) * 100 : 0;

  const exportResult = () => {
    const headers = ['Q#', 'Type', 'Question', 'Student Answer', 'Correct Answer', 'Correct?', 'Points', 'Max Points'];
    const rows = attempt.questions.map((q) => [
      q.questionNumber,
      q.type,
      q.question,
      q.studentAnswer ?? '',
      q.correctAnswer ?? '',
      q.isCorrect === null ? 'Skipped' : q.isCorrect ? 'Yes' : 'No',
      q.points,
      q.maxPoints,
    ]);
    downloadCsv(`${attempt.studentId ?? attempt.attemptId}_result.csv`, headers, rows);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 flex flex-col">
        {/* Header with Gradient Background */}
        <div className="relative bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white rounded-t-2xl flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </Button>

          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="size-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
              <User className="size-10 text-white" />
            </div>

            {/* Student Info */}
            <div className="flex-1">
              <h2 className="text-2xl mb-1">{attempt.studentName}</h2>
              <p className="text-teal-100 mb-4">Student ID: {attempt.studentId ?? 'N/A'}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {attempt.startTime && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <Calendar className="size-4" />
                    <span>
                      Started: {new Date(attempt.startTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {attempt.submitTime && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <CheckCircle className="size-4" />
                    <span>
                      Submitted: {new Date(attempt.submitTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Score Badge */}
            <div className="text-center bg-white/20 backdrop-blur-sm px-6 py-4 rounded-2xl border-2 border-white/30">
              <Trophy className="size-8 mx-auto mb-2 text-amber-300" />
              <p className="text-4xl mb-1">{attempt.score.toFixed(2)}</p>
              <p className="text-sm text-teal-100">Score / 10</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="size-6 text-green-600" />
              </div>
              <p className="text-2xl text-green-700 mb-1">{correctCount}</p>
              <p className="text-xs text-gray-600">Correct</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-red-50 to-pink-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="size-6 text-red-600" />
              </div>
              <p className="text-2xl text-red-700 mb-1">{incorrectCount}</p>
              <p className="text-xs text-gray-600">Incorrect</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="size-6 text-amber-600" />
              </div>
              <p className="text-2xl text-amber-700 mb-1">{skippedCount}</p>
              <p className="text-xs text-gray-600">Skipped</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="size-6 text-blue-600" />
              </div>
              <p className="text-xl text-blue-700 mb-1">{attempt.timeSpent}</p>
              <p className="text-xs text-gray-600">Time Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-200">
            <TabsList className="bg-gray-100 p-1 rounded-lg">
              <TabsTrigger
                value="answers"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
              >
                Answer Details
              </TabsTrigger>
              <TabsTrigger
                value="statistics"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
              >
                Performance Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Answer Details Tab */}
          <TabsContent
            value="answers"
            className="flex-1 overflow-y-auto p-6 space-y-4 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
            style={{ maxHeight: 'calc(90vh - 480px)' }}
          >
            {attempt.questions.map((q) => (
              <Card
                key={q.questionNumber}
                className={`shadow-lg rounded-2xl overflow-hidden border-l-4 ${
                  q.isCorrect === true
                    ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-white'
                    : q.isCorrect === false
                    ? 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-white'
                    : 'border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-white'
                }`}
              >
                <CardContent className="p-5">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {q.isCorrect === true && (
                          <div className="size-10 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="size-6 text-green-600" />
                          </div>
                        )}
                        {q.isCorrect === false && (
                          <div className="size-10 bg-red-100 rounded-full flex items-center justify-center">
                            <XCircle className="size-6 text-red-600" />
                          </div>
                        )}
                        {q.isCorrect === null && (
                          <div className="size-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="size-6 text-amber-600" />
                          </div>
                        )}
                      </div>

                      {/* Question Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-gray-800 text-white">
                            Question {q.questionNumber}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              q.type === 'mcq'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : q.type === 'true-false'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }
                          >
                            {q.type === 'mcq'
                              ? 'Multiple Choice'
                              : q.type === 'true-false'
                              ? 'True/False'
                              : 'Essay'}
                          </Badge>
                        </div>
                        <p className="text-gray-800 text-lg">{q.question}</p>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                      <p className="text-2xl text-gray-800">
                        {q.points}
                        <span className="text-lg text-gray-400">/{q.maxPoints}</span>
                      </p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Student Answer */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="size-4 text-gray-600" />
                        <p className="text-sm text-gray-600">Student's Answer</p>
                      </div>
                      <div
                        className={`p-4 rounded-xl border-2 ${
                          q.isCorrect === true
                            ? 'bg-green-50 border-green-200'
                            : q.isCorrect === false
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <p className="text-gray-800">
                          {q.studentAnswer || (
                            <span className="text-gray-400 italic">Not answered</span>
                          )}
                        </p>
                        {q.isCorrect === true && (
                          <div className="flex items-center gap-1 mt-2 text-green-700">
                            <CheckCircle className="size-4" />
                            <span className="text-xs">Correct!</span>
                          </div>
                        )}
                        {q.isCorrect === false && (
                          <div className="flex items-center gap-1 mt-2 text-red-700">
                            <XCircle className="size-4" />
                            <span className="text-xs">Incorrect</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Correct Answer */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="size-4 text-green-600" />
                        <p className="text-sm text-gray-600">Correct Answer</p>
                      </div>
                      <div className="p-4 rounded-xl border-2 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <p className="text-gray-800">{q.correctAnswer ?? 'Manual grading'}</p>
                        <div className="flex items-center gap-1 mt-2 text-green-700">
                          <Star className="size-4 fill-green-600" />
                          <span className="text-xs">Reference answer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent
            value="statistics"
            className="flex-1 overflow-y-auto p-6 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
            style={{ maxHeight: 'calc(90vh - 480px)' }}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Performance Overview */}
              <Card className="shadow-lg rounded-2xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg text-gray-800">Performance Overview</h3>
                      <p className="text-sm text-gray-600">Detailed breakdown of results</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Overall Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Overall Score</span>
                        <span className="text-2xl text-gray-800">{attempt.score.toFixed(2)} / 10</span>
                      </div>
                      <Progress value={Math.min(attempt.score * 10, 100)} className="h-3" />
                      <p className="text-xs text-gray-500 mt-1">
                        {attempt.score >= 9
                          ? '🎉 Excellent performance!'
                          : attempt.score >= 7.5
                          ? '👍 Good job!'
                          : attempt.score >= 6
                          ? '✓ Satisfactory'
                          : '⚠ Needs improvement'}
                      </p>
                    </div>

                    {/* Correct Answers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Correct Answers</span>
                        <span className="text-lg text-green-700">
                          {correctCount} / {attempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                          style={{ width: `${correctPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Incorrect Answers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Incorrect Answers</span>
                        <span className="text-lg text-red-700">
                          {incorrectCount} / {attempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
                          style={{
                            width: `${attempt.totalQuestions ? (incorrectCount / attempt.totalQuestions) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Skipped */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Skipped Questions</span>
                        <span className="text-lg text-amber-700">
                          {skippedCount} / {attempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                          style={{
                            width: `${attempt.totalQuestions ? (skippedCount / attempt.totalQuestions) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="size-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-gray-600">Time Spent</p>
                        <p className="text-2xl text-gray-800">{attempt.timeSpent}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Award className="size-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-gray-600">Accuracy Rate</p>
                        <p className="text-2xl text-gray-800">{correctPercentage.toFixed(0)}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {correctCount} out of {attempt.totalQuestions - skippedCount} attempted
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Summary */}
              <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
                <CardContent className="p-6">
                  <h4 className="text-gray-800 mb-4 flex items-center gap-2">
                    <Star className="size-5 text-amber-500 fill-amber-500" />
                    Performance Summary
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Total Score</span>
                      <span className="text-gray-800">{attempt.score.toFixed(2)} / 10</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Questions Attempted</span>
                      <span className="text-gray-800">
                        {attempt.totalQuestions - skippedCount} / {attempt.totalQuestions}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Success Rate</span>
                      <span className="text-gray-800">{correctPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Completion Status</span>
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        Completed
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6 hover:bg-gray-100 border-gray-300"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Results
          </Button>
          <Button
            variant="outline"
            onClick={exportResult}
            className="hover:bg-green-50 hover:border-green-300 border-green-200"
          >
            <Download className="size-4 mr-2 text-green-600" />
            Export Result
          </Button>
        </div>
      </div>
    </div>
  );
}
