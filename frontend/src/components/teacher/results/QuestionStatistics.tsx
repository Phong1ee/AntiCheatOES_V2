import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { CheckSquare, Circle, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Minus } from 'lucide-react';
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

function rateStyle(rate: number) {
  if (rate >= 80) return { text: 'text-green-600', bar: 'from-green-400 to-green-600' };
  if (rate >= 60) return { text: 'text-amber-600', bar: 'from-amber-400 to-amber-500' };
  return { text: 'text-red-600', bar: 'from-red-400 to-red-500' };
}

function PerformanceLabel({ rate }: { rate: number }) {
  if (rate >= 80) return <span className="inline-flex items-center gap-1 text-xs text-green-600"><TrendingUp className="size-3" /> Good</span>;
  if (rate >= 60) return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Minus className="size-3" /> Fair</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-600"><TrendingDown className="size-3" /> Needs Review</span>;
}

function OutcomeCard({ label, count, rate, className }: { label: string; count: number; rate: number; className: string }) {
  return <div className={`rounded-lg border px-3 py-2 ${className}`}><p className="text-xs">{label}</p><p className="text-lg font-semibold">{count} <span className="text-xs font-normal">({rate}%)</span></p></div>;
}

function QuestionCard({ stat }: { stat: QuestionStat }) {
  const [expanded, setExpanded] = useState(false);
  const isEssay = stat.type === 'essay';
  const typeInfo = typeConfig[stat.type];
  const TypeIcon = typeInfo.icon;
  const diffInfo = difficultyConfig[stat.difficulty] ?? difficultyConfig.medium;
  const primaryRate = isEssay ? stat.essayStats?.averageScoreRate : stat.correctRate;
  const style = rateStyle(primaryRate ?? 0);

  return (
    <div className={`overflow-hidden rounded-xl border-l-4 bg-white shadow-sm ${diffInfo.bar}`}>
      <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50" onClick={() => setExpanded((value) => !value)}>
        <div className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-50 text-sm font-semibold ${style.text}`}>{stat.questionNumber}</div>
        <p className="flex-1 truncate text-sm text-gray-800">{stat.questionText}</p>
        <div className="hidden flex-shrink-0 items-center gap-2 md:flex"><Badge variant="outline" className={`text-xs ${typeInfo.color}`}><TypeIcon className="mr-1 size-3" />{typeInfo.label}</Badge><Badge variant="outline" className={`text-xs ${diffInfo.color}`}>{diffInfo.label}</Badge></div>
        <div className={`w-20 flex-shrink-0 text-right ${style.text}`}><p className="text-lg font-semibold leading-none">{primaryRate ?? '-'}{primaryRate === null ? '' : '%'}</p><p className="mt-0.5 text-[10px] text-gray-400">{isEssay ? 'avg. score' : 'correct rate'}</p></div>
        {expanded ? <ChevronUp className="size-4 flex-shrink-0 text-gray-400" /> : <ChevronDown className="size-4 flex-shrink-0 text-gray-400" />}
      </button>

      {expanded && <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
        <p className="text-sm text-gray-700">{stat.questionText}</p>
        {!isEssay && stat.responseStats && <>
          <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs text-gray-500">Correct rate</span><span className={`text-sm font-medium ${style.text}`}>{stat.responseStats.correctRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${stat.responseStats.correctRate}%` }} /></div><div className="mt-1 flex items-center justify-between"><PerformanceLabel rate={stat.responseStats.correctRate} /><span className="text-xs text-gray-400">{stat.totalAttempts} students received this question</span></div></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><OutcomeCard label="Correct" count={stat.responseStats.correctCount} rate={stat.responseStats.correctRate} className="border-green-200 bg-green-50 text-green-800" /><OutcomeCard label="Incorrect" count={stat.responseStats.incorrectCount} rate={stat.responseStats.incorrectRate} className="border-red-200 bg-red-50 text-red-800" /><OutcomeCard label="Unanswered" count={stat.responseStats.unansweredCount} rate={stat.responseStats.unansweredRate} className="border-gray-200 bg-gray-50 text-gray-800" /></div>
        </>}
        {isEssay && stat.essayStats && <div className="space-y-3">
          <div><div className="mb-1.5 flex items-center justify-between"><span className="text-xs text-gray-500">Average graded score</span><span className={`text-sm font-medium ${style.text}`}>{stat.essayStats.averageScoreRate ?? 'Not graded'}{stat.essayStats.averageScoreRate === null ? '' : '%'}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${stat.essayStats.averageScoreRate ?? 0}%` }} /></div></div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><OutcomeCard label="Answered" count={stat.essayStats.answeredCount} rate={stat.essayStats.answeredRate} className="border-blue-200 bg-blue-50 text-blue-800" /><OutcomeCard label="Unanswered" count={stat.essayStats.unansweredCount} rate={stat.essayStats.unansweredRate} className="border-gray-200 bg-gray-50 text-gray-800" /><div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800"><p className="text-xs">Graded</p><p className="text-lg font-semibold">{stat.essayStats.gradedCount}</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800"><p className="text-xs">Pending grading</p><p className="text-lg font-semibold">{stat.essayStats.pendingGradingCount}</p></div></div>
        </div>}
        {stat.optionStats && <div className="space-y-2.5"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Answer Distribution</p>{stat.optionStats.map((option) => <div key={option.option} className="space-y-1"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><span className={`mt-0.5 inline-flex size-5 flex-shrink-0 items-center justify-center rounded text-xs font-semibold ${option.isCorrect ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{option.option}</span><span className={`text-sm leading-snug ${option.isCorrect ? 'font-medium text-green-700' : 'text-gray-600'}`}>{option.label}{option.isCorrect && <span className="ml-1.5 text-xs text-green-500">(correct)</span>}</span></div><span className="flex-shrink-0 text-sm font-medium text-gray-600">{option.selectionCount} ({option.percentage}%)</span></div><div className="ml-7 h-2 overflow-hidden rounded-full bg-gray-100"><div className={option.isCorrect ? 'h-full rounded-full bg-green-500' : 'h-full rounded-full bg-blue-400'} style={{ width: `${option.percentage}%` }} /></div></div>)}</div>}
      </div>}
    </div>
  );
}

interface QuestionStatisticsProps { examId: number; refreshKey: number; }

export function QuestionStatistics({ examId, refreshKey }: QuestionStatisticsProps) {
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService.getStatistics(examId).then((data) => { if (!cancelled) setStats(data); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load question statistics'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [examId, refreshKey]);

  if (loading) return <Card className="rounded-2xl border-0 shadow-md"><CardContent className="p-12"><LoadingState variant="inline" label="Loading question statistics..." /></CardContent></Card>;
  if (error) return <Card className="rounded-2xl border-0 shadow-md"><CardContent className="p-12 text-center text-red-600">{error}</CardContent></Card>;

  const objectiveStats = stats.filter((stat) => stat.type !== 'essay');
  return <Card className="rounded-2xl border-0 shadow-md"><CardHeader><CardTitle className="text-gray-800">Question Statistics</CardTitle><p className="mt-1 text-sm text-gray-600">One finalized representative attempt per student, selected by this exam&apos;s result strategy. Legacy score versions are excluded.</p></CardHeader><CardContent className="space-y-3">
    {stats.map((stat) => <QuestionCard key={stat.questionNumber} stat={stat} />)}
    {stats.length === 0 && <p className="py-8 text-center text-gray-500">No finalized question responses found for this exam.</p>}
    {objectiveStats.length > 0 && <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3"><div className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="mb-1 text-sm text-green-600">High Performance</p><p className="text-2xl text-green-700">{objectiveStats.filter((stat) => stat.correctRate >= 80).length}</p><p className="text-xs text-gray-500">Objective questions with ≥80% correct</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="mb-1 text-sm text-amber-600">Moderate Performance</p><p className="text-2xl text-amber-700">{objectiveStats.filter((stat) => stat.correctRate >= 60 && stat.correctRate < 80).length}</p><p className="text-xs text-gray-500">Objective questions with 60–79% correct</p></div><div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="mb-1 text-sm text-red-600">Needs Review</p><p className="text-2xl text-red-700">{objectiveStats.filter((stat) => stat.correctRate < 60).length}</p><p className="text-xs text-gray-500">Objective questions with &lt;60% correct</p></div></div>}
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><strong>Scope:</strong> blank objective answers are separate from incorrect answers. Essay statistics show response and grading status, not correct/incorrect.</div>
  </CardContent></Card>;
}
