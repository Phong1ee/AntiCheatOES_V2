import { BarChart3, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { StudentExamResultGroup } from "../../types/student-result";

interface ExamResultsStatsProps {
  groups: StudentExamResultGroup[];
}

function normalizedScore(group: StudentExamResultGroup): number | null {
  if (group.gradingPending || group.resultVisibility === "hidden" || !group.latestAttempt.scoreVisible || group.finalScore === null) {
    return null;
  }
  return group.finalScore;
}

function formatNormalizedScore(score: number): string {
  return score.toFixed(2);
}

export function ExamResultsStats({ groups }: ExamResultsStatsProps) {
  const visibleScores = groups.filter((group) => normalizedScore(group) !== null);
  const averageNormalizedScore = visibleScores.length
    ? visibleScores.reduce((sum, group) => sum + (normalizedScore(group) ?? 0), 0) / visibleScores.length
    : null;
  const topScores = [...visibleScores]
    .sort((first, second) => (normalizedScore(second) ?? 0) - (normalizedScore(first) ?? 0))
    .slice(0, 3);
  const scoredWithPassingRule = visibleScores.filter((group) => group.passingScore !== null);
  const passed = scoredWithPassingRule.filter((group) => group.finalScore !== null && group.finalScore >= (group.passingScore ?? 0)).length;
  const failed = scoredWithPassingRule.length - passed;
  const pending = groups.filter((group) => group.gradingPending || normalizedScore(group) === null).length;

  return (
    <aside className="w-80 space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="p-2 bg-teal-100 rounded-lg"><Target className="size-4 text-teal-600" /></span>Quick Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-sm text-gray-600">Completed Exams</span><span>{groups.length}</span></div>
          <div className="flex justify-between"><span className="text-sm text-gray-600">Published Results</span><span className="text-green-600">{visibleScores.length}</span></div>
          <div className="flex justify-between"><span className="text-sm text-gray-600">Pending Results</span><span className="text-yellow-600">{pending}</span></div>
          <div className="pt-3 border-t border-gray-200 flex justify-between items-center"><span className="text-sm text-gray-600">Average Score</span>{averageNormalizedScore === null ? <span className="text-sm text-gray-500">No scores available yet</span> : <span className="text-xl text-teal-700">{formatNormalizedScore(averageNormalizedScore)} / 10</span>}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="p-2 bg-yellow-100 rounded-lg"><Trophy className="size-4 text-yellow-600" /></span>Top Scores</CardTitle></CardHeader>
      <CardContent>{topScores.length ? <div className="space-y-3">{topScores.map((group, index) => <div key={group.examId} className="flex items-center gap-3 p-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-100"><span className="size-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm">{index + 1}</span><div className="flex-1 min-w-0"><p className="text-sm text-gray-800 truncate">{group.examTitle}</p><p className="text-xs text-gray-600">{group.subjectName}</p></div><span className="text-sm text-teal-700">{group.finalScore?.toFixed(2)} / 10</span></div>)}</div> : <p className="text-sm text-gray-600 text-center py-4">No scores available yet</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><span className="p-2 bg-blue-100 rounded-lg"><BarChart3 className="size-4 text-blue-600" /></span>Performance Overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200"><span className="text-sm text-green-800">Passed Exams</span><span className="text-green-700">{passed}</span></div>
          <div className="flex justify-between p-3 bg-red-50 rounded-lg border border-red-200"><span className="text-sm text-red-800">Failed Exams</span><span className="text-red-700">{failed}</span></div>
          <div className="flex justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"><span className="text-sm text-amber-800">Pending</span><span className="text-amber-700">{pending}</span></div>
        </CardContent>
      </Card>
    </aside>
  );
}
