import { useEffect, useState } from 'react';
import { teacherAntiCheatService } from '../../../services/teacher-anti-cheat.service';
import type { MonitorAttempt, MonitorDetail, MonitorExam, MonitorSubject } from '../../../types/teacher-anti-cheat';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Bot,
  User,
  Search,
  X,
  ChevronRight,
  Zap,
  Info,
  BookOpen,
  FileText,
  Filter,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttemptStatus = 'in-progress' | 'submitted' | 'terminated';
type AntiCheatStatus = 'clean' | 'warning' | 'flagged' | 'terminated';
type EventType = 'counted-violation' | 'automated-review' | 'system';
type EventMetadata = Record<string, string | number>;

interface AiFlag { label: string; detectedAt: string; metadata: EventMetadata; }

interface TimelineEvent {
  id: string;
  time: string;
  type: EventType;
  title: string;
  detail: string;
  metadata: EventMetadata;
}

interface Attempt {
  id: string;
  studentName: string;
  studentId: string;
  attemptStatus: AttemptStatus;
  violations: { count: number; max: number };
  aiFlags: AiFlag[];
  lastEvent: string;
  lastActivity: string;
  antiCheatStatus: AntiCheatStatus;
  score?: number;
  terminationReason?: string;
  examTitle?: string;
  aiFlagCount: number;
  policy: { maxViolations: number };
  violationBreakdown: { label: string; count: number }[];
  timeline: TimelineEvent[];
}

const METADATA_DISPLAY_FIELDS = ['confidence', 'durationMs', 'threshold', 'faceCount', 'qualityScore', 'shoulderVisibility', 'categoryName', 'detectorName', 'detectorVersion', 'modelVersion', 'policyVersion'] as const;

function readMetadata(value: unknown): EventMetadata {
  let candidate = value;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); } catch { return {}; }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  const record = candidate as Record<string, unknown>;
  return METADATA_DISPLAY_FIELDS.reduce<EventMetadata>((metadata, key) => {
    const item = record[key];
    if (typeof item === 'number' && Number.isFinite(item)) metadata[key] = item;
    if (typeof item === 'string') metadata[key] = item.slice(0, 120);
    return metadata;
  }, {});
}

function displayEventName(eventType: string) {
  return eventType.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapAttempt(attempt: MonitorAttempt): Attempt {
  const status = attempt.attemptStatus.replace('_', '-') as AttemptStatus;
  return {
    id: String(attempt.attemptId), studentName: attempt.studentName, studentId: attempt.studentId,
    attemptStatus: status, violations: { count: attempt.violationCount, max: attempt.violationLimit },
    aiFlags: [], aiFlagCount: attempt.aiFlagCount, lastEvent: attempt.lastEventType ?? '-',
    lastActivity: String(attempt.lastEventAt ?? ''),
    antiCheatStatus: status === 'terminated' ? 'terminated' : attempt.flagged ? 'flagged' : attempt.violationCount > 0 ? 'warning' : 'clean',
    score: attempt.score ?? undefined, terminationReason: attempt.terminationReason ?? undefined,
    policy: { maxViolations: attempt.violationLimit }, violationBreakdown: [], timeline: [],
  };
}

function mapDetail(detail: MonitorDetail): Attempt {
  const attempt = mapAttempt(detail.attempt);
  const aiFlags = detail.timeline
    .filter((event) => event.automatedFlag)
    .map((event) => ({ label: displayEventName(event.eventType), detectedAt: String(event.eventTimestamp), metadata: readMetadata(event.metadata) }));
  return {
    ...attempt,
    examTitle: detail.attempt.title,
    aiFlags,
    aiFlagCount: aiFlags.length,
    violationBreakdown: detail.breakdown.map((item) => ({ label: item.eventType, count: item.count })),
    timeline: detail.timeline.map((event, index) => ({
      id: `${event.eventTimestamp}-${index}`,
      time: String(event.eventTimestamp),
      type: event.isViolation && event.countsTowardLimit ? 'counted-violation' : event.automatedFlag ? 'automated-review' : 'system',
      title: event.eventType,
      detail: event.details || event.source,
      metadata: readMetadata(event.metadata),
    })),
  };
}

interface Exam {
  id: string;
  name: string;
  date: string;
  attempts: Attempt[];
}

interface Subject {
  id: string;
  code: string;
  name: string;
  exams: Exam[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const acConfig: Record<AntiCheatStatus, { label: string; cls: string; icon: typeof CheckCircle }> = {
  clean:      { label: 'No recorded flags', cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  warning:    { label: 'Warning',    cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertTriangle },
  flagged:    { label: 'Automated flags', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Bot },
  terminated: { label: 'Terminated', cls: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
};

const asConfig: Record<AttemptStatus, { label: string; cls: string }> = {
  'in-progress': { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  submitted:     { label: 'Submitted',   cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  terminated:    { label: 'Terminated',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

const eventDot: Record<EventType, string> = {
  'counted-violation': 'bg-red-500',
  'automated-review': 'bg-violet-400',
  system:    'bg-gray-300',
};


// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewCard({ icon: Icon, value, label, color }: { icon: typeof Shield; value: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div className={`size-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="size-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-800 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Shield; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="size-7 text-gray-300" />
      </div>
      <p className="text-gray-500 font-medium">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function AttemptDrawer({ attempt, onClose }: { attempt: Attempt; onClose: () => void }) {
  const ac = acConfig[attempt.antiCheatStatus];
  const AcIcon = ac.icon;

  const eventTypeLabel: Record<EventType, string> = {
    'counted-violation': 'Counted Violation',
    'automated-review': 'Automated Review Flag',
    system: 'System Event',
  };

  const eventCardStyle: Record<EventType, string> = {
    'counted-violation': 'border-l-red-400 bg-red-50/40',
    'automated-review': 'border-l-violet-400 bg-violet-50/40',
    system: 'border-l-gray-300 bg-gray-50/60',
  };

  const eventBadgeStyle: Record<EventType, string> = {
    'counted-violation': 'bg-red-100 text-red-700',
    'automated-review': 'bg-violet-100 text-violet-700',
    system: 'bg-gray-100 text-gray-500',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '82vw', maxWidth: '1200px', maxHeight: '88vh' }}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-start justify-between px-8 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-11 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="size-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 leading-tight">{attempt.studentName}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{attempt.studentId}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-1" />
            <div>
              <p className="text-xs text-gray-400">Exam</p>
              <p className="text-sm text-gray-700 font-medium">{attempt.examTitle ?? 'Exam details'}</p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="outline" className={`text-xs ${asConfig[attempt.attemptStatus].cls}`}>
                {asConfig[attempt.attemptStatus].label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${ac.cls}`}>
                <AcIcon className="size-3 mr-1" />
                {ac.label}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 mt-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
          {/* Counted violations */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">Counted Violations</p>
            <p className={`text-2xl font-semibold ${attempt.violations.count >= attempt.violations.max ? 'text-red-600' : attempt.violations.count > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
              {attempt.violations.count}
              <span className="text-sm font-normal text-gray-400 ml-1">/ {attempt.violations.max}</span>
            </p>
          </div>
          {/* Automated review flags */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">Automated Flags</p>
            <p className={`text-2xl font-semibold ${attempt.aiFlagCount >= 2 ? 'text-violet-600' : attempt.aiFlagCount > 0 ? 'text-amber-500' : 'text-gray-800'}`}>
              {attempt.aiFlagCount}
            </p>
          </div>
          {/* Current Question */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">Current Question</p>
            <p className="text-2xl font-semibold text-gray-800">-</p>
          </div>
          {/* Time Remaining */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">Time Remaining</p>
            <p className={`text-2xl font-semibold ${attempt.attemptStatus === 'terminated' ? 'text-red-500' : 'text-gray-800'}`}>
              {attempt.attemptStatus === 'terminated' ? 'Ended' : '-'}
            </p>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Left: Timeline (65%) */}
          <div className="flex-[65] overflow-y-auto px-8 py-6 border-r border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Event Timeline</h3>
              {/* Legend */}
              <div className="flex items-center gap-4">
                {(['counted-violation', 'automated-review', 'system'] as EventType[]).map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className={`size-2 rounded-full ${eventDot[type]}`} />
                    <span className="text-xs text-gray-400">{eventTypeLabel[type]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative pl-6 space-y-3">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-0 bottom-0 w-px bg-gray-100" />

              {attempt.timeline.map((event, idx) => (
                <div key={event.id} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-6 top-4 size-3.5 rounded-full border-2 border-white shadow-sm ${eventDot[event.type]}`} />

                  <div className={`rounded-xl border-l-4 border border-gray-100 px-4 py-3 ${eventCardStyle[event.type]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-800">{event.title}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${eventBadgeStyle[event.type]}`}>
                            {eventTypeLabel[event.type]}
                          </span>
                          {event.type === 'counted-violation' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              #{attempt.violationBreakdown.length > 0 ? idx : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.detail}</p>
                        {Object.keys(event.metadata).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <span key={key} className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-gray-600">
                                {key}: {typeof value === 'number' ? Number(value.toFixed(3)) : value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-medium text-gray-400">{event.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Details (35%) */}
          <div className="flex-[35] overflow-y-auto px-6 py-6 space-y-6 bg-gray-50/50">

            {/* Termination reason */}
            {attempt.terminationReason && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                <XCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-700 mb-0.5">Termination Reason</p>
                  <p className="text-sm text-red-700">{attempt.terminationReason}</p>
                </div>
              </div>
            )}

            {/* Applied Policy */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Applied Policy</p>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Shared violation limit</span>
                  <span className="text-gray-800 font-medium">{attempt.policy.maxViolations}</span>
                </div>
              </div>
            </div>

            {/* Violation Breakdown */}
            {attempt.violationBreakdown.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Violation Breakdown</p>
                <div className="space-y-2">
                  {attempt.violationBreakdown.map((v) => (
                    <div key={v.label} className="flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-red-400" />
                        <span className="text-sm text-gray-700">{v.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{v.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Automated vision and audio flags are classified by the backend policy. */}
            {attempt.aiFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Automated Detection</p>
                  <div className="group relative">
                    <Info className="size-3.5 text-gray-400 cursor-help" />
                    <div className="absolute right-0 top-5 z-10 w-60 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                      Automated detections may be inaccurate. Review the attempt context before drawing conclusions.
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {attempt.aiFlags.map((f, i) => (
                    <div key={i} className="border rounded-xl border-violet-100 bg-violet-50 px-4 py-3 text-violet-700">
                      <div className="flex items-center gap-2">
                        <Bot className="size-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{f.label}</span>
                      </div>
                      <span className="text-xs opacity-60 whitespace-nowrap">{f.detectedAt}</span>
                      {Object.keys(f.metadata).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(f.metadata).map(([key, value]) => <span key={key} className="rounded bg-white/80 px-1.5 py-0.5 text-[10px]">{key}: {typeof value === 'number' ? Number(value.toFixed(3)) : value}</span>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clean state */}
            {attempt.violationBreakdown.length === 0 && attempt.aiFlags.length === 0 && !attempt.terminationReason && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle className="size-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-green-700">No recorded violations or automated flags</p>
                <p className="text-xs text-gray-400 mt-1">No detector conclusion is inferred from an empty timeline.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky Footer ── */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-white flex-shrink-0">
          <Button variant="outline" size="sm" className="text-gray-500">
            <FileText className="size-4 mr-1.5" />
            Add Review Note
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-200 hover:bg-teal-50">
              <Zap className="size-4 mr-1.5" />
              View Exam Result
            </Button>
            <Button size="sm" onClick={onClose} className="bg-gray-800 hover:bg-gray-900 text-white">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AntiCheatMonitor() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [attemptStatusFilter, setAttemptStatusFilter] = useState('all');
  const [antiCheatFilter, setAntiCheatFilter] = useState('all');
  const [drawerAttempt, setDrawerAttempt] = useState<Attempt | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;
  const selectedExam = selectedSubject?.exams.find((e) => e.id === selectedExamId) ?? null;

  const handleSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    setSelectedExamId(null);
    setSearch('');
    setAttemptStatusFilter('all');
    setAntiCheatFilter('all');
    teacherAntiCheatService.exams(id).then((items: MonitorExam[]) => setSubjects((current) => current.map((subject) => subject.id === id ? { ...subject, exams: items.map((exam) => ({ id: String(exam.examId), name: exam.title, date: String(exam.startTime ?? ''), attempts: [] })) } : subject)));
  };

  const handleExamChange = (id: string) => {
    setSelectedExamId(id);
    setSearch('');
    setAttemptStatusFilter('all');
    setAntiCheatFilter('all');
    if (!selectedSubjectId) return;
    teacherAntiCheatService.attempts(id).then((items: MonitorAttempt[]) => {
      const mapped = items.map(mapAttempt);
      setSubjects((current) => current.map((subject) => subject.id !== selectedSubjectId ? subject : { ...subject, exams: subject.exams.map((exam) => exam.id === id ? { ...exam, attempts: mapped } : exam) }));
    });
  };

  useEffect(() => { teacherAntiCheatService.subjects().then((items: MonitorSubject[]) => setSubjects(items.map((item) => ({ id: item.subjectId, code: item.code, name: item.name, exams: [] })))); }, []);

  const attempts = selectedExam?.attempts ?? [];

  const filtered = attempts.filter((a) => {
    const matchSearch =
      a.studentName.toLowerCase().includes(search.toLowerCase()) ||
      a.studentId.toLowerCase().includes(search.toLowerCase());
    const matchAttempt = attemptStatusFilter === 'all' || a.attemptStatus === attemptStatusFilter;
    const matchAC = antiCheatFilter === 'all' || a.antiCheatStatus === antiCheatFilter;
    return matchSearch && matchAttempt && matchAC;
  });

  const hasFilters = search || attemptStatusFilter !== 'all' || antiCheatFilter !== 'all';

  const counts = {
    active:     attempts.filter((a) => a.attemptStatus === 'in-progress').length,
    warning:    attempts.filter((a) => a.antiCheatStatus === 'warning').length,
    flagged:    attempts.filter((a) => a.antiCheatStatus === 'flagged').length,
    terminated: attempts.filter((a) => a.antiCheatStatus === 'terminated').length,
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2.5">
              <Shield className="size-6 text-teal-600" />
              Anti-Cheat Monitor
            </h1>
            <p className="text-sm text-gray-500 mt-1">Review counted violations, automated flags, and system events for a selected exam.</p>
          </div>

          {/* Selectors + Refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Subject */}
            <Select value={selectedSubjectId ?? ''} onValueChange={handleSubjectChange}>
              <SelectTrigger className="w-[240px] bg-white shadow-sm">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium text-gray-700">{s.code}</span>
                    <span className="text-gray-400 ml-1.5">— {s.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Exam */}
            <Select
              value={selectedExamId ?? ''}
              onValueChange={handleExamChange}
              disabled={!selectedSubjectId || !selectedSubject || selectedSubject.exams.length === 0}
            >
              <SelectTrigger className="w-[220px] bg-white shadow-sm disabled:opacity-50">
                <SelectValue placeholder={selectedSubject && selectedSubject.exams.length === 0 ? "No exams available" : "Select an exam"} />
              </SelectTrigger>
              <SelectContent>
                {(selectedSubject?.exams ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    <span className="text-gray-400 ml-1.5 text-xs">({e.date})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="bg-white shadow-sm"
              disabled={!selectedExamId}
            >
              <RefreshCw className="size-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Empty states */}
        {!selectedSubjectId && (
          <EmptyState icon={BookOpen} title="No subject selected" description="Select a subject to view its exams." />
        )}

        {selectedSubjectId && !selectedExamId && (
          <EmptyState
            icon={FileText}
            title={selectedSubject?.exams.length === 0 ? "No exams available" : "No exam selected"}
            description={selectedSubject?.exams.length === 0 ? "No exams available for this subject." : "Select an exam to view anti-cheat activity."}
          />
        )}

        {/* Monitor content */}
        {selectedExamId && selectedExam && (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <OverviewCard icon={Zap}           value={counts.active}     label="Active Attempts"  color="bg-blue-500" />
              <OverviewCard icon={AlertTriangle} value={counts.warning}    label="Warning"          color="bg-amber-400" />
              <OverviewCard icon={Bot}           value={counts.flagged}    label="Automated Flags" color="bg-violet-500" />
              <OverviewCard icon={XCircle}       value={counts.terminated} label="Terminated"       color="bg-red-500" />
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="size-4 text-gray-400 flex-shrink-0" />
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Select value={attemptStatusFilter} onValueChange={setAttemptStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9 text-sm">
                    <SelectValue placeholder="Attempt Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attempts</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={antiCheatFilter} onValueChange={setAntiCheatFilter}>
                  <SelectTrigger className="w-[160px] h-9 text-sm">
                    <SelectValue placeholder="Anti-Cheat Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="clean">No recorded flags</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="flagged">Automated flags</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setAttemptStatusFilter('all'); setAntiCheatFilter('all'); }} className="text-gray-400 hover:text-gray-600">
                    <X className="size-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Detector outcomes require human review. */}
            <div className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <Info className="size-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                Automated detection may be inaccurate. Review the attempt context before drawing conclusions.
              </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100">
                    <TableHead className="text-xs font-medium text-gray-500">Student</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Attempt</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">Counted Violations</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">Automated Flags</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Last Event</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Activity</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Anti-Cheat</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((attempt) => {
                    const ac = acConfig[attempt.antiCheatStatus];
                    const AcIcon = ac.icon;
                    const as_ = asConfig[attempt.attemptStatus];

                    return (
                      <TableRow key={attempt.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="text-sm text-gray-800">{attempt.studentName}</p>
                            <p className="text-xs text-gray-400">{attempt.studentId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${as_.cls}`}>{as_.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${
                            attempt.violations.count >= attempt.violations.max
                              ? 'text-red-600'
                              : attempt.violations.count > 0
                              ? 'text-amber-600'
                              : 'text-gray-400'
                          }`}>
                            {attempt.violations.count} / {attempt.violations.max}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${
                            attempt.aiFlagCount >= 2
                              ? 'text-violet-600'
                              : attempt.aiFlagCount > 0
                              ? 'text-amber-500'
                              : 'text-gray-400'
                          }`}>
                            {attempt.aiFlagCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-600">{attempt.lastEvent}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-400">{attempt.lastActivity}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${ac.cls}`}>
                            <AcIcon className="size-3 mr-1" />
                            {ac.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              teacherAntiCheatService.detail(Number(attempt.id))
                                .then((detail) => setDrawerAttempt(mapDetail(detail)))
                                .catch(() => setDrawerAttempt(attempt));
                            }}
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 text-xs"
                          >
                            View
                            <ChevronRight className="size-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                        {attempts.length === 0
                          ? 'No attempt data available for this exam.'
                          : 'No attempts match your filters.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {drawerAttempt && (
        <AttemptDrawer attempt={drawerAttempt} onClose={() => setDrawerAttempt(null)} />
      )}
    </div>
  );
}
