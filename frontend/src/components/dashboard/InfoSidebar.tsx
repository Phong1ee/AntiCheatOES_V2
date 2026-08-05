import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Camera, Mic, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { StudentExamResult } from '../../types/student-result';
import type { StudentExamListItem } from '../../services/student-exam.service';
import { selectActiveAndUpcomingExams } from '../../utils/student-exam-dashboard';
import { NextExamWidget } from './NextExamWidget';
import { ExamCodesWidget } from './ExamCodesWidget';

interface InfoSidebarProps {
  results: StudentExamResult[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  exams: StudentExamListItem[];
  serverTime: string | null;
}

const formatDate = (date: string | null) => {
  if (!date) return 'Date unavailable';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const recentResults = (results: StudentExamResult[]) => [...results]
  .sort((first, second) => (second.date ? new Date(second.date).getTime() : 0) - (first.date ? new Date(first.date).getTime() : 0))
  .slice(0, 3);

export function InfoSidebar({ results, loading, loadError, onRetry, exams, serverTime }: InfoSidebarProps) {
  const completedExamIds = new Set(results
    .filter((result) => result.attemptStatus === 'submitted' || result.attemptStatus === 'terminated')
    .map((result) => result.examId));
  const scoredResults = results.filter((result) => (
    result.status === 'published'
    && result.scoreVisible
    && result.score !== null
  ));
  const averageScore = scoredResults.length
    ? scoredResults.reduce((sum, result) => sum + result.score!, 0) / scoredResults.length
    : null;
  const passableResults = scoredResults.filter((result) => result.passingScore !== null);
  const passedCount = passableResults.filter((result) => result.score! >= result.passingScore!).length;
  const serverNow = serverTime ? new Date(serverTime) : new Date();
  const activeAndUpcomingExams = selectActiveAndUpcomingExams(exams, serverNow);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Exams Taken</p>
                <p className="text-xl text-gray-800">{completedExamIds.size}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Score</p>
                <p className="text-xl text-gray-800">
                  {averageScore === null ? 'No scores available yet' : `${averageScore.toFixed(2)} / 10`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Passed Exams</p>
              <p className="text-xl text-gray-800">{passedCount} / {passableResults.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <NextExamWidget exams={activeAndUpcomingExams} serverTime={serverTime} onCountdownElapsed={onRetry} />

      <ExamCodesWidget exams={activeAndUpcomingExams.filter((exam) => exam.status === 'open')} />

      <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Pre-Exam Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <Camera className="size-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm text-gray-800">Check your camera</p>
              <p className="text-xs text-gray-500">Ensure it's working properly</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <Mic className="size-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm text-gray-800">Test your microphone</p>
              <p className="text-xs text-gray-500">Required for proctoring</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Recent Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-gray-600">Loading recent results...</p>}
          {loadError && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
            </div>
          )}
          {!loading && !loadError && results.length === 0 && (
            <p className="text-sm text-gray-600">No results available yet.</p>
          )}
          {!loading && !loadError && recentResults(results).map((result) => (
            <div key={result.attemptId} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{result.examTitle}</p>
                <p className="text-xs text-gray-500">{formatDate(result.date)}</p>
              </div>
              {result.scoreVisible && result.score !== null ? (
                <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 whitespace-nowrap">
                  {result.score.toFixed(2)} / 10
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600 whitespace-nowrap">
                  {!result.scoreVisible ? 'Result hidden' : 'Awaiting grading'}
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
