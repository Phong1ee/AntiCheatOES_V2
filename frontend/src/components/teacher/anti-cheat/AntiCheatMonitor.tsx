import { useEffect, useRef, useState } from 'react';
import { teacherAntiCheatService } from '../../../services/teacher-anti-cheat.service';
import type { MonitorAttempt, MonitorAttemptPage, MonitorDetail, MonitorExam, MonitorStudent, MonitorSubject } from '../../../types/teacher-anti-cheat';
import { eventCategory, eventLabel, formatEventDetails } from '../../../anti-cheat/event-presentation';
import { normalizeSearchText } from '../../../utils/search';
import {
  Shield,
  Trophy,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Bot,
  User,
  Search,
  X,
  ChevronLeft,
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
type EventType = 'violation' | 'ai-flag' | 'system';

interface AiFlag {
  type: 'no-face' | 'multiple-faces' | 'gaze-away' | 'head-away' | 'speech';
  label: string;
  detectedAt: string;
}

interface TimelineEvent {
  id: string;
  time: string;
  type: EventType;
  title: string;
  detail: string;
}

interface Attempt {
  id: string;
  studentName: string;
  studentId: string;
  attemptNo: number | null;
  attemptStatus: AttemptStatus;
  /** This attempt alone determines the student's recorded result. */
  isFinalResult: boolean;
  /** Eligible to feed the final score (all of them, when averaging). */
  countsTowardResult: boolean;
  violations: { count: number; max: number };
  aiFlags: AiFlag[];
  startTime?: string;
  submittedAt?: string;
  antiCheatStatus: AntiCheatStatus;
  score?: number;
  terminationReason?: string;
  examTitle?: string;
  aiFlagCount: number;
  cameraFlagCount: number;
  audioFlagCount: number;
  browserViolationCount: number;
  policy: { maxViolations: number };
  violationBreakdown: { label: string; count: number }[];
  timeline: TimelineEvent[];
}

function mapAiFlag(eventType: string, detectedAt: string): AiFlag | null {
  const flags: Record<string, AiFlag['type']> = {
    NO_FACE_DETECTED: 'no-face',
    MULTIPLE_FACES_DETECTED: 'multiple-faces',
    GAZE_AWAY_SUSTAINED: 'gaze-away',
    HEAD_AWAY_SUSTAINED: 'head-away',
    MULTIPLE_VOICES_DETECTED: 'speech',
  };
  const type = flags[eventType];
  return type ? { type, label: eventType.replaceAll('_', ' ').toLowerCase(), detectedAt } : null;
}

function mapAttempt(attempt: MonitorAttempt): Attempt {
  const status = attempt.attemptStatus.replace('_', '-') as AttemptStatus;
  return {
    id: String(attempt.attemptId), studentName: attempt.studentName, studentId: attempt.studentId,
    attemptNo: attempt.attemptNo ?? null,
    isFinalResult: attempt.isFinalResult ?? false,
    countsTowardResult: attempt.countsTowardResult ?? false,
    attemptStatus: status, violations: { count: attempt.violationCount, max: attempt.violationLimit },
    aiFlags: [], aiFlagCount: attempt.aiFlagCount,
    startTime: attempt.startTime ? String(attempt.startTime) : undefined,
    submittedAt: attempt.submittedAt ? String(attempt.submittedAt) : undefined,
    antiCheatStatus: status === 'terminated' ? 'terminated' : attempt.flagged ? 'flagged' : attempt.violationCount > 0 ? 'warning' : 'clean',
    score: attempt.score ?? undefined, terminationReason: attempt.terminationReason ?? undefined,
    cameraFlagCount: attempt.cameraFlagCount ?? 0, audioFlagCount: attempt.audioFlagCount ?? 0, browserViolationCount: attempt.browserViolationCount ?? 0,
    policy: { maxViolations: attempt.violationLimit }, violationBreakdown: [], timeline: [],
  };
}

function mapDetail(detail: MonitorDetail): Attempt {
  const attempt = mapAttempt(detail.attempt);
  const aiFlags = detail.timeline
    .map((event) => mapAiFlag(event.eventType, String(event.eventTimestamp)))
    .filter((event): event is AiFlag => event !== null);
  return {
    ...attempt,
    examTitle: detail.attempt.title,
    aiFlags,
    aiFlagCount: aiFlags.length,
    violationBreakdown: detail.breakdown.map((item) => ({ label: item.eventType, count: item.count })),
    timeline: detail.timeline.map((event, index) => ({
      id: `${event.eventTimestamp}-${index}`,
      time: String(event.eventTimestamp),
      type: event.isViolation ? 'violation' : ['camera', 'microphone'].includes(eventCategory(event.eventType, event.source)) ? 'ai-flag' : 'system',
      title: eventLabel(event.eventType),
      detail: `${eventCategory(event.eventType, event.source)} · ${formatEventDetails(event.details, event.metadata)}`,
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
  clean:      { label: 'Clean',      cls: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle },
  warning:    { label: 'Warning',    cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertTriangle },
  flagged:    { label: 'AI Flagged', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Bot },
  terminated: { label: 'Terminated', cls: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
};

const asConfig: Record<AttemptStatus, { label: string; cls: string }> = {
  'in-progress': { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  submitted:     { label: 'Submitted',   cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  terminated:    { label: 'Terminated',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

const eventDot: Record<EventType, string> = {
  violation: 'bg-red-500',
  'ai-flag': 'bg-violet-400',
  system:    'bg-gray-300',
};

const aiFlagColor: Record<AiFlag['type'], string> = {
  'no-face':       'bg-violet-50 text-violet-700 border-violet-200',
  'multiple-faces':'bg-orange-50 text-orange-700 border-orange-200',
  'gaze-away':     'bg-sky-50 text-sky-700 border-sky-200',
  'head-away':     'bg-cyan-50 text-cyan-700 border-cyan-200',
  phone:           'bg-amber-50 text-amber-700 border-amber-200',
  speech:          'bg-rose-50 text-rose-700 border-rose-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * One cell of the summary strip. Tones reuse the same status hues as the table
 * badges so a colour means the same thing in both places, and each tile carries
 * an icon plus a label so the state never rests on colour alone.
 */
function StatTile({ icon: Icon, value, label, tint, chip, ink }: {
  icon: typeof Shield; value: number; label: string; tint: string; chip: string; ink: string;
}) {
  const empty = value === 0;
  return (
    <div className={`flex items-center gap-3 px-5 py-4 transition-colors ${empty ? 'bg-white' : tint}`}>
      <div className={`size-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${empty ? 'bg-gray-200' : chip}`}>
        <Icon className="size-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-semibold leading-none ${empty ? 'text-gray-300' : ink}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1 truncate">{label}</p>
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

function AttemptDrawer({ attempt, onClose, onViewExamResult }: {
  attempt: Attempt;
  onClose: () => void;
  /** Opens this attempt's graded result; absent while the attempt is still running. */
  onViewExamResult?: () => void;
}) {
  const ac = acConfig[attempt.antiCheatStatus];
  const AcIcon = ac.icon;

  const eventTypeLabel: Record<EventType, string> = {
    violation: 'Direct Violation',
    'ai-flag': 'AI Flag',
    system: 'System Event',
  };

  const eventCardStyle: Record<EventType, string> = {
    violation: 'border-l-red-400 bg-red-50/40',
    'ai-flag': 'border-l-violet-400 bg-violet-50/40',
    system: 'border-l-gray-300 bg-gray-50/60',
  };

  const eventBadgeStyle: Record<EventType, string> = {
    violation: 'bg-red-100 text-red-700',
    'ai-flag': 'bg-violet-100 text-violet-700',
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
          {/* Direct Violations */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">Direct Violations</p>
            <p className={`text-2xl font-semibold ${attempt.violations.count >= attempt.violations.max ? 'text-red-600' : attempt.violations.count > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
              {attempt.violations.count}
              <span className="text-sm font-normal text-gray-400 ml-1">/ {attempt.violations.max}</span>
            </p>
          </div>
          {/* AI Flags */}
          <div className="px-8 py-4">
            <p className="text-xs text-gray-400 mb-1">AI Flags</p>
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
                {(['violation', 'ai-flag', 'system'] as EventType[]).map((type) => (
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
                          {event.type === 'violation' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              #{attempt.violationBreakdown.length > 0 ? idx : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.detail}</p>
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

            {/* AI Suspicious Flags */}
            {attempt.aiFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Suspicious Flags</p>
                  <div className="group relative">
                    <Info className="size-3.5 text-gray-400 cursor-help" />
                    <div className="absolute right-0 top-5 z-10 w-60 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                      AI flags indicate suspicious activity for teacher review. They do not automatically count toward the violation limit.
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {attempt.aiFlags.map((f, i) => (
                    <div key={i} className={`flex items-center justify-between border rounded-xl px-4 py-3 ${aiFlagColor[f.type]}`}>
                      <div className="flex items-center gap-2">
                        <Bot className="size-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{f.label}</span>
                      </div>
                      <span className="text-xs opacity-60 whitespace-nowrap">{f.detectedAt}</span>
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
                <p className="text-sm font-medium text-green-700">No violations detected</p>
                <p className="text-xs text-gray-400 mt-1">This attempt appears clean.</p>
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
            {onViewExamResult && (
              <Button
                variant="outline"
                size="sm"
                className="text-teal-600 border-teal-200 hover:bg-teal-50"
                onClick={onViewExamResult}
              >
                <Zap className="size-4 mr-1.5" />
                View Exam Result
              </Button>
            )}
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

export interface AntiCheatTarget {
  subjectId: string;
  examId: string;
  studentId: string;
  /** When set, the drawer opens straight onto this attempt. */
  attemptId?: number | null;
  /** Bumped per navigation so repeat requests for the same student re-fire. */
  requestKey: number;
}

interface AntiCheatMonitorProps {
  initialTarget?: AntiCheatTarget | null;
  onTargetHandled?: (requestKey: number) => void;
  /** Switches to the results tab with this attempt's detail already open. */
  onViewExamResult?: (target: { examId: string; attemptId: number }) => void;
}

export function AntiCheatMonitor({ initialTarget, onTargetHandled, onViewExamResult }: AntiCheatMonitorProps = {}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<MonitorStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<MonitorStudent | null>(null);
  const [attemptPage, setAttemptPage] = useState<MonitorAttemptPage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [attemptStatusFilter, setAttemptStatusFilter] = useState('all');
  const [antiCheatFilter, setAntiCheatFilter] = useState('all');
  const [drawerAttempt, setDrawerAttempt] = useState<Attempt | null>(null);
  const pollingInFlight = useRef(false);
  const detailPollingInFlight = useRef(false);
  const initialTargetRef = useRef(initialTarget);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;
  const selectedExam = selectedSubject?.exams.find((e) => e.id === selectedExamId) ?? null;

  const handleSubjectChange = (id: string) => {
    setMonitorError(null);
    setSelectedSubjectId(id);
    setSelectedExamId(null);
    setAssignedStudents([]);
    setSelectedStudent(null);
    setAttemptPage(null);
    setSearch('');
    setAttemptStatusFilter('all');
    setAntiCheatFilter('all');
    teacherAntiCheatService.exams(id).then((items: MonitorExam[]) => setSubjects((current) => current.map((subject) => subject.id === id ? { ...subject, exams: items.map((exam) => ({ id: String(exam.examId), name: exam.title, date: String(exam.startTime ?? ''), attempts: [] })) } : subject)));
  };

  const handleExamChange = (id: string) => {
    setMonitorError(null);
    setSelectedExamId(id);
    setSelectedStudent(null);
    setAttemptPage(null);
    setAssignedStudents([]);
    setSearch('');
    setAttemptStatusFilter('all');
    setAntiCheatFilter('all');
    if (!selectedSubjectId) return;
    teacherAntiCheatService.students(id).then(setAssignedStudents);
  };

  const loadStudentAttempts = async (student: MonitorStudent, page: number) => {
    if (!selectedExamId || !selectedSubjectId) return;
    const result = await teacherAntiCheatService.studentAttempts(selectedExamId, student.studentId, page);
    setAttemptPage(result);
    const mapped = result.items.map(mapAttempt);
    setSubjects((current) => current.map((subject) => subject.id !== selectedSubjectId ? subject : { ...subject, exams: subject.exams.map((exam) => exam.id === selectedExamId ? { ...exam, attempts: mapped } : exam) }));
  };

  const handleStudentSelect = (student: MonitorStudent) => {
    setMonitorError(null);
    setSelectedStudent(student);
    setSearch('');
    setAttemptStatusFilter('all');
    setAntiCheatFilter('all');
    void loadStudentAttempts(student, 1).catch(() => setMonitorError('Unable to load this student\'s attempts.'));
  };

  const refreshSelectedData = async () => {
    if (!selectedExamId || pollingInFlight.current) return;
    setMonitorError(null);
    setIsRefreshing(true);
    pollingInFlight.current = true;
    try {
      if (selectedStudent) await loadStudentAttempts(selectedStudent, attemptPage?.page ?? 1);
      else setAssignedStudents(await teacherAntiCheatService.students(selectedExamId));
    } catch {
      setMonitorError('Unable to refresh monitor data. Please try again.');
    } finally {
      pollingInFlight.current = false;
      setIsRefreshing(false);
    }
  };

  // Skipped when arriving via a deep link, which loads the subject list itself
  // as part of its chain and would otherwise be clobbered by this.
  useEffect(() => {
    if (initialTargetRef.current) return;
    teacherAntiCheatService.subjects().then((items: MonitorSubject[]) => setSubjects(items.map((item) => ({ id: item.subjectId, code: item.code, name: item.name, exams: [] }))));
  }, []);

  /**
   * Deep link from the exam results table: walk subject -> exam -> student so
   * the monitor opens already scoped to that one student's attempts.
   */
  useEffect(() => {
    if (!initialTarget) return undefined;
    const target = initialTarget;
    let disposed = false;

    const open = async () => {
      setMonitorError(null);
      setSelectedSubjectId(target.subjectId);
      setSelectedExamId(target.examId);
      setSelectedStudent(null);
      setAttemptPage(null);
      setAssignedStudents([]);
      setSearch('');
      setAttemptStatusFilter('all');
      setAntiCheatFilter('all');
      try {
        const [subjectItems, examItems] = await Promise.all([
          teacherAntiCheatService.subjects(),
          teacherAntiCheatService.exams(target.subjectId),
        ]);
        if (disposed) return;
        setSubjects(subjectItems.map((item: MonitorSubject) => ({
          id: item.subjectId,
          code: item.code,
          name: item.name,
          exams: item.subjectId !== target.subjectId ? [] : examItems.map((exam: MonitorExam) => ({
            id: String(exam.examId),
            name: exam.title,
            date: String(exam.startTime ?? ''),
            attempts: [],
          })),
        })));

        const students = await teacherAntiCheatService.students(target.examId);
        if (disposed) return;
        setAssignedStudents(students);

        const match = students.find((student) => student.studentId === target.studentId) ?? null;
        if (!match) {
          setMonitorError('That student is no longer assigned to this exam.');
          return;
        }
        setSelectedStudent(match);

        const page = await teacherAntiCheatService.studentAttempts(target.examId, match.studentId, 1);
        if (disposed) return;
        setAttemptPage(page);
        if (target.attemptId) {
          const detail = await teacherAntiCheatService.detail(target.attemptId);
          if (disposed) return;
          setDrawerAttempt(mapDetail(detail));
        }
        const mapped = page.items.map(mapAttempt);
        setSubjects((current) => current.map((subject) => subject.id !== target.subjectId ? subject : {
          ...subject,
          exams: subject.exams.map((exam) => exam.id === target.examId ? { ...exam, attempts: mapped } : exam),
        }));
      } catch {
        if (!disposed) setMonitorError('Unable to open the anti-cheat record for this student.');
      } finally {
        if (!disposed) onTargetHandled?.(target.requestKey);
      }
    };

    void open();
    return () => { disposed = true; };
  }, [initialTarget?.requestKey]);

  useEffect(() => {
    if (!selectedExamId || !selectedSubjectId || !selectedStudent) return;
    let disposed = false;
    const poll = async () => {
      if (disposed || document.hidden || pollingInFlight.current) return;
      pollingInFlight.current = true;
      try {
        const result = await teacherAntiCheatService.studentAttempts(selectedExamId, selectedStudent.studentId, attemptPage?.page ?? 1);
        setAttemptPage(result);
        const mapped = result.items.map(mapAttempt);
        setSubjects((current) => current.map((subject) => subject.id !== selectedSubjectId ? subject : {
          ...subject,
          exams: subject.exams.map((exam) => exam.id === selectedExamId ? { ...exam, attempts: mapped } : exam),
        }));
      } catch {
        if (!disposed) setMonitorError('Live monitor update failed. Retrying shortly.');
      } finally {
        pollingInFlight.current = false;
      }
    };
    const onVisibilityChange = () => { if (!document.hidden) void poll(); };
    void poll();
    const interval = window.setInterval(() => void poll(), 4_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [attemptPage?.page, selectedExamId, selectedStudent, selectedSubjectId]);

  useEffect(() => {
    if (!drawerAttempt || drawerAttempt.attemptStatus !== 'in-progress') return;
    let disposed = false;
    const attemptId = Number(drawerAttempt.id);
    const pollDetail = async () => {
      if (disposed || document.hidden || detailPollingInFlight.current) return;
      detailPollingInFlight.current = true;
      try {
        const detail = await teacherAntiCheatService.detail(attemptId);
        if (!disposed) setDrawerAttempt(mapDetail(detail));
      } catch {
        if (!disposed) setMonitorError('Live attempt detail update failed. Retrying shortly.');
      } finally {
        detailPollingInFlight.current = false;
      }
    };
    void pollDetail();
    const interval = window.setInterval(() => void pollDetail(), 4_000);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [drawerAttempt?.id, drawerAttempt?.attemptStatus]);

  const attempts = selectedExam?.attempts ?? [];

  const filtered = attempts.filter((a) => {
    const matchSearch =
      normalizeSearchText(a.studentName).includes(normalizeSearchText(search)) ||
      normalizeSearchText(a.studentId).includes(normalizeSearchText(search));
    const matchAttempt = attemptStatusFilter === 'all' || a.attemptStatus === attemptStatusFilter;
    const matchAC = antiCheatFilter === 'all' || a.antiCheatStatus === antiCheatFilter;
    return matchSearch && matchAttempt && matchAC;
  });

  const resultStrategy = attemptPage?.resultStrategy ?? 'highest';
  const finalAttemptId = attemptPage?.finalAttemptId ?? null;

  /** Loads full detail for an attempt and opens the drawer on it. */
  const openAttempt = (attemptId: number, fallback?: Attempt) => {
    teacherAntiCheatService.detail(attemptId)
      .then((detail) => setDrawerAttempt(mapDetail(detail)))
      .catch(() => {
        if (fallback) setDrawerAttempt(fallback);
        else setMonitorError('Unable to open that attempt.');
      });
  };
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
        <div className="rounded-2xl shadow-sm px-6 py-5 flex items-start justify-between gap-4 flex-wrap bg-gradient-to-r from-teal-50 via-white to-blue-50 border border-teal-100/70">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 shadow-sm">
                <Shield className="size-5 text-white" />
              </span>
              Anti-Cheat Monitor
            </h1>
            <p className="text-sm text-gray-500 mt-1">Monitor violations, AI flags, and terminated attempts for a selected exam.</p>
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
              disabled={!selectedExamId || isRefreshing}
              onClick={() => void refreshSelectedData()}
            >
              <RefreshCw className={`size-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
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

        {monitorError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{monitorError}</div>}

        {/* Assigned students */}
        {selectedExamId && selectedExam && !selectedStudent && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div><h2 className="text-lg font-semibold text-gray-800">Assigned Students</h2><p className="mt-1 text-sm text-gray-500">Select a student to view that student's attempts.</p></div>
              <Badge variant="outline" className="text-teal-700 border-teal-200">{assignedStudents.length} assigned</Badge>
            </div>
            <Table>
              <TableHeader><TableRow className="bg-gray-50 border-b border-gray-100"><TableHead className="text-xs font-medium text-gray-500">Student</TableHead><TableHead className="text-xs font-medium text-gray-500 text-center">Attempts</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {assignedStudents.map((student) => <TableRow key={student.studentId} className="hover:bg-gray-50"><TableCell><p className="text-sm text-gray-800">{student.studentName}</p><p className="text-xs text-gray-400">{student.studentId}</p></TableCell><TableCell className="text-center"><Badge variant="outline" className="text-xs">{student.attemptCount}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => handleStudentSelect(student)} className="text-teal-600 hover:bg-teal-50 hover:text-teal-700 text-xs">View Attempts<ChevronRight className="ml-1 size-3" /></Button></TableCell></TableRow>)}
                {assignedStudents.length === 0 && <TableRow><TableCell colSpan={3} className="py-12 text-center text-sm text-gray-400">No students are assigned to this exam.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Selected student's attempts */}
        {selectedExamId && selectedExam && selectedStudent && (
          <>
            {/* Student summary: identity, scope and counts in one surface */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-violet-500" />
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-teal-50/60 to-transparent">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User className="size-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-800 truncate">{selectedStudent.studentName}</h2>
                    <p className="text-sm text-gray-400 truncate">
                      {selectedStudent.studentId}
                      {attemptPage ? ` · ${attemptPage.total} attempt${attemptPage.total === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {finalAttemptId !== null && (
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-sm hover:from-teal-600 hover:to-blue-700"
                      onClick={() => openAttempt(finalAttemptId)}
                      title="Open the attempt that determines this student's recorded score"
                    >
                      <Trophy className="mr-1.5 size-4" />
                      Final result
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelectedStudent(null); setAttemptPage(null); }}
                  >
                    <ChevronLeft className="mr-1.5 size-4" />Back to students
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-white">
                <StatTile icon={Zap}           value={counts.active}     label="Active attempts"
                  tint="bg-blue-50"   chip="bg-gradient-to-br from-blue-500 to-blue-600"     ink="text-blue-700" />
                <StatTile icon={AlertTriangle} value={counts.warning}    label="Warning"
                  tint="bg-amber-50"  chip="bg-gradient-to-br from-amber-400 to-amber-500"   ink="text-amber-700" />
                <StatTile icon={Bot}           value={counts.flagged}    label="AI flagged"
                  tint="bg-violet-50" chip="bg-gradient-to-br from-violet-500 to-violet-600" ink="text-violet-700" />
                <StatTile icon={XCircle}       value={counts.terminated} label="Terminated"
                  tint="bg-red-50"    chip="bg-gradient-to-br from-red-500 to-red-600"       ink="text-red-700" />
              </div>
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
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="flagged">AI Flagged</SelectItem>
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

            {/* AI flags notice */}
            <div className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <Info className="size-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Incident totals</span> are refreshed from server-authoritative anti-cheat events.
                No camera or microphone media is shown here.
              </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100">
                    <TableHead className="text-xs font-medium text-gray-500">Student</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">Attempt</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Status</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">Direct Violations</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">AI Flags</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-center">Flag Summary</TableHead>
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
                      <TableRow
                        key={attempt.id}
                        className={`transition-colors ${
                          attempt.isFinalResult
                            ? 'bg-teal-50/70 hover:bg-teal-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <TableCell>
                          <div>
                            <p className="text-sm text-gray-800">{attempt.studentName}</p>
                            <p className="text-xs text-gray-400">{attempt.studentId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-medium ${attempt.isFinalResult ? 'text-teal-800' : 'text-gray-700'}`}>
                              {attempt.attemptNo === null ? '-' : `#${attempt.attemptNo}`}
                            </span>
                            {attempt.isFinalResult ? (
                              <Badge className="text-[10px] border-0 bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-sm hover:from-teal-500 hover:to-blue-600">
                                <Trophy className="size-2.5 mr-1" />
                                Final result
                              </Badge>
                            ) : attempt.countsTowardResult && resultStrategy === 'average' ? (
                              <Badge className="text-[10px] border-0 bg-teal-100 text-teal-800 hover:bg-teal-100">
                                Counts
                              </Badge>
                            ) : null}
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
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1 text-[11px]">
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">Cam {attempt.cameraFlagCount}</span>
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">Audio {attempt.audioFlagCount}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Browser {attempt.browserViolationCount}</span>
                          </div>
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
                            onClick={() => openAttempt(Number(attempt.id), attempt)}
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
            {attemptPage && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-5 py-3 shadow-sm">
                <p className="text-sm text-gray-500">Page {attemptPage.page} of {Math.max(attemptPage.totalPages, 1)} · {attemptPage.total} attempt(s)</p>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={attemptPage.page <= 1} onClick={() => loadStudentAttempts(selectedStudent, attemptPage.page - 1)}><ChevronLeft className="mr-1 size-4" />Previous</Button><Button variant="outline" size="sm" disabled={attemptPage.page >= attemptPage.totalPages} onClick={() => loadStudentAttempts(selectedStudent, attemptPage.page + 1)}>Next<ChevronRight className="ml-1 size-4" /></Button></div>
              </div>
            )}
          </>
        )}
      </div>

      {drawerAttempt && (
        <AttemptDrawer
          attempt={drawerAttempt}
          onClose={() => setDrawerAttempt(null)}
          // A running attempt has no graded result to show yet.
          onViewExamResult={onViewExamResult && selectedExamId && drawerAttempt.attemptStatus !== 'in-progress'
            ? () => {
                onViewExamResult({ examId: selectedExamId, attemptId: Number(drawerAttempt.id) });
                setDrawerAttempt(null);
              }
            : undefined}
        />
      )}
    </div>
  );
}
