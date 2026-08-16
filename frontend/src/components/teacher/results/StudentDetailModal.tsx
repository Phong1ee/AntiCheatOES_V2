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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Bot,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { teacherResultsService, downloadCsv } from '../../../services/teacher-results.service';
import { teacherAntiCheatService } from '../../../services/teacher-anti-cheat.service';
import type { MonitorDetail } from '../../../types/teacher-anti-cheat';
import type { StudentAttemptDetail } from '../../../types/teacher-results';
import { LoadingState } from '../common/LoadingState';

interface StudentDetailModalProps {
  examId: number;
  attemptId: number;
  onClose: () => void;
  /** Opens the anti-cheat monitor on this student's attempt. */
  onViewAntiCheat?: (studentId: string, attemptId: number) => void;
}

/** Mirrors the derivation used by the anti-cheat monitor so both agree. */
const antiCheatTone = {
  clean: {
    label: 'Clean', icon: ShieldCheck, rail: 'border-l-green-500',
    band: 'bg-green-50 border-b-green-200', chip: 'bg-green-500', ink: 'text-green-700',
    btn: 'bg-white border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800',
  },
  warning: {
    label: 'Warning', icon: ShieldAlert, rail: 'border-l-amber-500',
    band: 'bg-amber-50 border-b-amber-200', chip: 'bg-amber-500', ink: 'text-amber-700',
    btn: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800',
  },
  flagged: {
    label: 'AI Flagged', icon: Bot, rail: 'border-l-violet-500',
    band: 'bg-violet-50 border-b-violet-200', chip: 'bg-violet-500', ink: 'text-violet-700',
    btn: 'bg-white border-violet-300 text-violet-700 hover:bg-violet-100 hover:text-violet-800',
  },
  terminated: {
    label: 'Terminated', icon: ShieldX, rail: 'border-l-red-500',
    band: 'bg-red-50 border-b-red-200', chip: 'bg-red-500', ink: 'text-red-700',
    btn: 'bg-white border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800',
  },
} as const;

export function StudentDetailModal({ examId, attemptId, onClose, onViewAntiCheat }: StudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState('answers');
  const [attempt, setAttempt] = useState<StudentAttemptDetail | null>(null);
  const [antiCheat, setAntiCheat] = useState<MonitorDetail | null>(null);
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

  // Secondary and non-blocking: the answer view still works without it.
  useEffect(() => {
    let cancelled = false;
    setAntiCheat(null);
    teacherAntiCheatService
      .detail(attemptId)
      .then((data) => { if (!cancelled) setAntiCheat(data); })
      .catch(() => { if (!cancelled) setAntiCheat(null); });
    return () => { cancelled = true; };
  }, [attemptId]);

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

  const stats = [
    { icon: CheckCircle, value: String(correctCount),   label: 'Correct',   tint: 'bg-green-50',  chip: 'bg-green-500',  ink: 'text-green-700' },
    { icon: XCircle,     value: String(incorrectCount), label: 'Incorrect', tint: 'bg-red-50',    chip: 'bg-red-500',    ink: 'text-red-700' },
    { icon: AlertCircle, value: String(skippedCount),   label: 'Skipped',   tint: 'bg-amber-50',  chip: 'bg-amber-500',  ink: 'text-amber-700' },
    { icon: Clock,       value: attempt.timeSpent,      label: 'Time',      tint: 'bg-blue-50',   chip: 'bg-blue-500',   ink: 'text-blue-700' },
  ];

  const stamp = (value: string) => new Date(value).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      {/* max-h + flex lets the answer list own the leftover height instead of a
          hardcoded chrome offset, which was starving it on short viewports. */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-teal-500 to-blue-600 px-5 py-3.5 text-white flex items-center gap-4">
          <div className="size-11 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0">
            <User className="size-5 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Which exam and which attempt - the modal can be reached straight
                from the anti-cheat monitor, without the exam page for context. */}
            <p className="flex items-center gap-1.5 text-[11px] text-teal-100 leading-none mb-1">
              <FileText className="size-3 flex-shrink-0" />
              <span className="truncate">{attempt.examName}</span>
              {attempt.attemptNumber !== null && (
                <span className="flex-shrink-0 rounded-full bg-white/20 border border-white/30 px-1.5 py-0.5 text-[10px] font-medium">
                  Attempt {attempt.attemptNumber}
                </span>
              )}
            </p>
            <h2 className="text-lg font-semibold leading-tight truncate">{attempt.studentName}</h2>
            <p className="text-xs text-teal-100 truncate">
              {attempt.studentId ?? 'N/A'}
              {attempt.startTime && ` · started ${stamp(attempt.startTime)}`}
              {attempt.submitTime && ` · submitted ${stamp(attempt.submitTime)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5 border border-white/30 flex-shrink-0">
            <Trophy className="size-4 text-amber-300" />
            <span className="text-xl font-semibold leading-none">{attempt.score.toFixed(2)}</span>
            <span className="text-xs text-teal-100">/ 100</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20 flex-shrink-0 size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Stat strip */}
        <div className="flex-shrink-0 grid grid-cols-4 divide-x-2 divide-white border-b border-gray-200">
          {stats.map(({ icon: Icon, value, label, tint, chip, ink }) => (
            <div key={label} className={`flex items-center gap-2.5 px-4 py-2.5 ${tint}`}>
              <span className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 ${chip}`}>
                <Icon className="size-3.5 text-white" />
              </span>
              <span className="min-w-0">
                <span className={`block text-base font-semibold leading-none ${ink}`}>{value}</span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{label}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Anti-cheat */}
        {antiCheat && (() => {
          const record = antiCheat.attempt;
          const status = String(record.attemptStatus).replace('_', '-') === 'terminated'
            ? 'terminated'
            : record.flagged
            ? 'flagged'
            : record.violationCount > 0
            ? 'warning'
            : 'clean';
          const tone = antiCheatTone[status];
          const ToneIcon = tone.icon;
          return (
            <div className={`flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-l-4 ${tone.band} ${tone.rail}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={`size-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${tone.chip}`}>
                  <ToneIcon className="size-5 text-white" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Anti-cheat
                    </span>
                    <span className={`text-sm font-semibold ${tone.ink}`}>{tone.label}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    <span className={`font-semibold ${tone.ink}`}>{record.violationCount}</span>
                    <span className="text-gray-400">/{record.violationLimit}</span> violations
                    {' · '}
                    <span className={`font-semibold ${record.aiFlagCount > 0 ? 'text-violet-700' : 'text-gray-500'}`}>
                      {record.aiFlagCount}
                    </span> AI flag{record.aiFlagCount === 1 ? '' : 's'}
                    {record.terminationReason && (
                      <span className="text-red-600"> · {record.terminationReason}</span>
                    )}
                  </p>
                </div>
              </div>
              {onViewAntiCheat && attempt.studentId && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`text-xs flex-shrink-0 shadow-sm ${tone.btn}`}
                  onClick={() => onViewAntiCheat(attempt.studentId as string, attemptId)}
                >
                  More detail
                  <ChevronRight className="size-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })()}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-5 pt-3 pb-2 border-b border-gray-200">
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
            className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
          >
            {attempt.questions.map((q) => {
              const answered = Boolean(q.studentAnswer);
              const tone = q.isCorrect === true
                ? { rail: 'border-l-green-500', chip: 'bg-green-100 text-green-600', box: 'bg-green-50 border-green-200' }
                : q.isCorrect === false
                ? { rail: 'border-l-red-500', chip: 'bg-red-100 text-red-600', box: 'bg-red-50 border-red-200' }
                : { rail: 'border-l-amber-500', chip: 'bg-amber-100 text-amber-600', box: 'bg-amber-50 border-amber-200' };
              const StatusIcon = q.isCorrect === true ? CheckCircle : q.isCorrect === false ? XCircle : AlertCircle;
              return (
                <div
                  key={q.questionNumber}
                  className={`rounded-xl border border-gray-200 border-l-4 bg-white ${tone.rail}`}
                >
                  <div className="p-4">
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className={`size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tone.chip}`}>
                          <StatusIcon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge className="bg-gray-800 text-white text-[10px] px-1.5 py-0">Q{q.questionNumber}</Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                q.type === 'mcq'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : q.type === 'true-false'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'true-false' ? 'True/False' : 'Essay'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-800 leading-snug">{q.question}</p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 leading-none">
                        <p className="text-base font-semibold text-gray-800">
                          {q.points}
                          <span className="text-xs font-normal text-gray-400">/{q.maxPoints}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">points</p>
                      </div>
                    </div>

                    {/* Answers */}
                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                          <User className="size-3" />
                          Student&apos;s Answer
                        </p>
                        <div className={`px-3 py-2 rounded-lg border text-sm ${tone.box}`}>
                          <p className="text-gray-800">
                            {q.studentAnswer || <span className="text-gray-400 italic">Not answered</span>}
                          </p>
                          {/* An unanswered question is reported as such rather than
                              as a wrong answer the student actually gave. */}
                          <p className={`flex items-center gap-1 mt-1 text-[11px] ${
                            !answered ? 'text-gray-500' : q.isCorrect === true ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {!answered ? (
                              <><AlertCircle className="size-3" />No answer submitted</>
                            ) : q.isCorrect === true ? (
                              <><CheckCircle className="size-3" />Correct</>
                            ) : q.isCorrect === false ? (
                              <><XCircle className="size-3" />Incorrect</>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                          <Award className="size-3 text-green-600" />
                          Correct Answer
                        </p>
                        <div className="px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-sm">
                          <p className="text-gray-800">{q.correctAnswer ?? 'Manual grading'}</p>
                          <p className="flex items-center gap-1 mt-1 text-[11px] text-green-700">
                            <Star className="size-3 fill-green-600" />
                            Reference answer
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent
            value="statistics"
            className="flex-1 min-h-0 overflow-y-auto p-5 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
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
                        <span className="text-2xl text-gray-800">{attempt.score.toFixed(2)} / 100</span>
                      </div>
                      <Progress value={Math.min(attempt.score, 100)} className="h-3" />
                      <p className="text-xs text-gray-500 mt-1">
                        {attempt.score >= 90
                          ? '🎉 Excellent performance!'
                          : attempt.score >= 75
                          ? '👍 Good job!'
                          : attempt.score >= 60
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
                      <span className="text-gray-800">{attempt.score.toFixed(2)} / 100</span>
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="hover:bg-gray-100 border-gray-300"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Results
          </Button>
          <Button
            variant="outline"
            size="sm"
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
