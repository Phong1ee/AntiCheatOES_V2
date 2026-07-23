import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Database,
  Library,
  ClipboardCheck,
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  ChevronRight,
  ArrowLeft,
  GraduationCap,
  BookOpen,
  CheckSquare,
  Circle,
  FileText,
  Link2,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart2,
  X,
  GitCompare,
  AlertTriangle,
  Save,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type QType = 'mcq' | 'true-false' | 'essay' | 'matching';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Answer {
  text: string;
  isCorrect: boolean;
}

interface QuestionSnapshot {
  type: QType;
  difficulty: Difficulty;
  text: string;
  subject: string;
  chapters: string[];
  learningObjectives: string[];
  answers?: Answer[];
  editedAt: string;
}

interface BankQuestion {
  id: string;
  type: QType;
  text: string;
  subject: string;
  department: string;
  chapter: string;
  learningObjectives?: string[];
  difficulty: Difficulty;
  options?: string[];
  correctAnswer?: string;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

interface PendingQuestion {
  id: string;
  type: QType;
  difficulty: Difficulty;
  text: string;
  subject: string;
  chapters: string[];
  learningObjectives: string[];
  answers?: Answer[];
  submittedBy: string;
  submittedAt: string;
  usedInExams: number;
  previousVersion?: QuestionSnapshot;
}

interface SubjectMeta {
  name: string;
  code: string;
  color: string;
  iconColor: string;
  dept: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const SUBJECTS: SubjectMeta[] = [
  { name: 'Database Systems', code: 'IT3120', color: 'bg-blue-500/10', iconColor: 'text-blue-500', dept: 'Computer Science' },
  { name: 'Data Structures', code: 'IT2000', color: 'bg-emerald-500/10', iconColor: 'text-emerald-500', dept: 'Computer Science' },
  { name: 'Algorithms', code: 'IT2030', color: 'bg-violet-500/10', iconColor: 'text-violet-500', dept: 'Computer Science' },
  { name: 'Web Development', code: 'IT4409', color: 'bg-amber-500/10', iconColor: 'text-amber-500', dept: 'Computer Science' },
  { name: 'Operating Systems', code: 'IT3070', color: 'bg-rose-500/10', iconColor: 'text-rose-500', dept: 'Computer Science' },
  { name: 'Network Security', code: 'IT4360', color: 'bg-teal-500/10', iconColor: 'text-teal-500', dept: 'Information Technology' },
  { name: 'Cloud Computing', code: 'IT4520', color: 'bg-sky-500/10', iconColor: 'text-sky-500', dept: 'Information Technology' },
  { name: 'Mobile Development', code: 'IT4735', color: 'bg-orange-500/10', iconColor: 'text-orange-500', dept: 'Information Technology' },
  { name: 'Calculus', code: 'MA1001', color: 'bg-indigo-500/10', iconColor: 'text-indigo-500', dept: 'Mathematics' },
  { name: 'Linear Algebra', code: 'MA1002', color: 'bg-pink-500/10', iconColor: 'text-pink-500', dept: 'Mathematics' },
  { name: 'Statistics', code: 'MA3010', color: 'bg-cyan-500/10', iconColor: 'text-cyan-500', dept: 'Mathematics' },
];

const MOCK_BANK: BankQuestion[] = [
  { id: 'b1', type: 'mcq', text: 'What is the primary key in a relational database?', subject: 'Database Systems', department: 'Computer Science', chapter: 'Introduction to Databases', difficulty: 'easy', options: ['A column that contains duplicate values', 'A unique identifier for each row in a table', 'A foreign key reference', 'An index for faster searches'], correctAnswer: 'A unique identifier for each row in a table', createdBy: 'Dr. Smith', createdAt: '2024-09-15', usageCount: 15 },
  { id: 'b2', type: 'mcq', text: 'Which normal form eliminates partial dependencies?', subject: 'Database Systems', department: 'Computer Science', chapter: 'Normalization', difficulty: 'medium', options: ['1NF', '2NF', '3NF', 'BCNF'], correctAnswer: '2NF', createdBy: 'Dr. Smith', createdAt: '2024-09-20', usageCount: 12 },
  { id: 'b3', type: 'essay', text: 'Explain the difference between INNER JOIN and LEFT JOIN with examples.', subject: 'Database Systems', department: 'Computer Science', chapter: 'SQL Joins', difficulty: 'hard', createdBy: 'Dr. Smith', createdAt: '2024-09-22', usageCount: 8 },
  { id: 'b4', type: 'true-false', text: 'A primary key can contain NULL values.', subject: 'Database Systems', department: 'Computer Science', chapter: 'SQL Basics', difficulty: 'easy', correctAnswer: 'False', createdBy: 'Dr. Smith', createdAt: '2024-10-01', usageCount: 20 },
  { id: 'b5', type: 'mcq', text: 'What is the time complexity of binary search?', subject: 'Data Structures', department: 'Computer Science', chapter: 'Searching Algorithms', difficulty: 'medium', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 'O(log n)', createdBy: 'Dr. Williams', createdAt: '2024-10-10', usageCount: 18 },
  { id: 'b6', type: 'true-false', text: 'A stack follows FIFO principle.', subject: 'Data Structures', department: 'Computer Science', chapter: 'Stacks & Queues', difficulty: 'easy', correctAnswer: 'False', createdBy: 'Dr. Williams', createdAt: '2024-10-12', usageCount: 25 },
  { id: 'b7', type: 'mcq', text: 'Which HTML tag is used to define a hyperlink?', subject: 'Web Development', department: 'Computer Science', chapter: 'HTML Basics', difficulty: 'easy', options: ['<a>', '<link>', '<href>', '<url>'], correctAnswer: '<a>', createdBy: 'Prof. Johnson', createdAt: '2024-11-01', usageCount: 30 },
  { id: 'b8', type: 'essay', text: 'Explain the box model in CSS.', subject: 'Web Development', department: 'Computer Science', chapter: 'CSS Basics', difficulty: 'medium', createdBy: 'Prof. Johnson', createdAt: '2024-11-05', usageCount: 6 },
];

const MOCK_PENDING: PendingQuestion[] = [
  {
    id: 'p1',
    type: 'true-false',
    difficulty: 'easy',
    text: 'HTTP is a stateless protocol.',
    subject: 'Web Development',
    chapters: ['HTTP Protocols'],
    learningObjectives: ['LO1', 'LO2'],
    answers: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
    submittedBy: 'Nguyen Van A',
    submittedAt: '2025-07-20',
    usedInExams: 2,
  },
  {
    id: 'p2',
    type: 'mcq',
    difficulty: 'easy',
    text: 'Which CSS property is used to make text bold?',
    subject: 'Web Development',
    chapters: ['CSS Basics', 'Introduction to Web'],
    learningObjectives: ['LO1'],
    answers: [
      { text: 'font-weight: bold', isCorrect: true },
      { text: 'text-style: bold', isCorrect: false },
      { text: 'font-style: bold', isCorrect: false },
      { text: 'text-weight: bold', isCorrect: false },
    ],
    submittedBy: 'Nguyen Van A',
    submittedAt: '2025-07-21',
    usedInExams: 0,
    previousVersion: {
      type: 'mcq',
      difficulty: 'medium',
      text: 'Which CSS property controls text boldness?',
      subject: 'Web Development',
      chapters: ['CSS Basics'],
      learningObjectives: ['LO1', 'LO3'],
      answers: [
        { text: 'font-weight', isCorrect: true },
        { text: 'text-bold', isCorrect: false },
        { text: 'font-bold', isCorrect: false },
        { text: 'text-weight', isCorrect: false },
      ],
      editedAt: '2025-07-20',
    },
  },
  {
    id: 'p3',
    type: 'essay',
    difficulty: 'hard',
    text: 'Describe the MVC architecture pattern and its advantages in web development.',
    subject: 'Web Development',
    chapters: ['Architecture Patterns'],
    learningObjectives: ['LO2'],
    submittedBy: 'Tran Thi B',
    submittedAt: '2025-07-19',
    usedInExams: 0,
  },
  {
    id: 'p4',
    type: 'mcq',
    difficulty: 'easy',
    text: 'What does SQL stand for?',
    subject: 'Database Systems',
    chapters: ['SQL Basics', 'Introduction to Databases'],
    learningObjectives: ['LO1'],
    answers: [
      { text: 'Structured Query Language', isCorrect: true },
      { text: 'Simple Query Language', isCorrect: false },
      { text: 'Standard Query Logic', isCorrect: false },
      { text: 'Sequential Query Language', isCorrect: false },
    ],
    submittedBy: 'Le Van C',
    submittedAt: '2025-07-22',
    usedInExams: 3,
    previousVersion: {
      type: 'mcq',
      difficulty: 'easy',
      text: 'SQL stands for?',
      subject: 'Database Systems',
      chapters: ['SQL Basics'],
      learningObjectives: [],
      answers: [
        { text: 'Structured Query Language', isCorrect: true },
        { text: 'Simple Query List', isCorrect: false },
        { text: 'Stored Query Language', isCorrect: false },
        { text: 'Sequential Query Language', isCorrect: false },
      ],
      editedAt: '2025-07-21',
    },
  },
  {
    id: 'p5',
    type: 'true-false',
    difficulty: 'medium',
    text: 'JavaScript is a statically typed language.',
    subject: 'Web Development',
    chapters: ['JavaScript Basics'],
    learningObjectives: ['LO2', 'LO3'],
    answers: [{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: true }],
    submittedBy: 'Pham Thi D',
    submittedAt: '2025-07-18',
    usedInExams: 1,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<QType, { icon: React.ElementType; label: string; pill: string }> = {
  mcq: { icon: CheckSquare, label: 'Multiple Choice', pill: 'bg-blue-50 text-blue-600' },
  'true-false': { icon: Circle, label: 'True / False', pill: 'bg-violet-50 text-violet-600' },
  essay: { icon: FileText, label: 'Essay', pill: 'bg-amber-50 text-amber-600' },
  matching: { icon: Link2, label: 'Matching', pill: 'bg-emerald-50 text-emerald-600' },
};

const DIFF_CFG: Record<Difficulty, { label: string; pill: string; border: string; dot: string }> = {
  easy: { label: 'Easy', pill: 'bg-emerald-50 text-emerald-600', border: 'border-l-emerald-400', dot: 'bg-emerald-400' },
  medium: { label: 'Medium', pill: 'bg-amber-50 text-amber-600', border: 'border-l-amber-400', dot: 'bg-amber-400' },
  hard: { label: 'Hard', pill: 'bg-red-50 text-red-600', border: 'border-l-red-400', dot: 'bg-red-400' },
};

const LETTER = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Approval Detail Modal ────────────────────────────────────────────────────

function ApprovalDetailModal({
  q,
  onClose,
  onApprove,
  onReject,
}: {
  q: PendingQuestion;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const hasPrev = !!q.previousVersion;
  const prev = q.previousVersion;

  // Diff helpers
  const changed = (oldVal: unknown, newVal: unknown) =>
    JSON.stringify(oldVal) !== JSON.stringify(newVal);

  const FieldLabel = ({ label }: { label: string }) => (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
  );

  // Render a single field in side-by-side mode with diff highlight
  const DiffRow = ({
    label,
    oldVal,
    newVal,
    render,
  }: {
    label: string;
    oldVal: unknown;
    newVal: unknown;
    render: (val: unknown, side: 'old' | 'new') => React.ReactNode;
  }) => {
    const isDiff = changed(oldVal, newVal);
    return (
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl p-3 border ${isDiff ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
          <FieldLabel label={label} />
          <div className={isDiff ? 'text-red-800' : 'text-gray-700'}>{render(oldVal, 'old')}</div>
        </div>
        <div className={`rounded-xl p-3 border ${isDiff ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100'}`}>
          <FieldLabel label={label} />
          <div className={isDiff ? 'text-teal-900 font-medium' : 'text-gray-700'}>{render(newVal, 'new')}</div>
        </div>
      </div>
    );
  };

  const renderText = (val: unknown) => (
    <p className="text-sm leading-relaxed">{val as string || '—'}</p>
  );

  const renderPill = (val: unknown, side: 'old' | 'new') => {
    const isDiff = side === 'old'
      ? changed(val, q.type) || changed(val, q.difficulty)
      : false;
    return <p className="text-sm font-medium">{val as string || '—'}</p>;
  };

  const renderTypeVal = (val: unknown) => {
    const t = val as QType;
    const cfg = TYPE_CFG[t];
    if (!cfg) return <span className="text-sm">—</span>;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.pill}`}>
        <cfg.icon className="size-3.5" />{cfg.label}
      </span>
    );
  };

  const renderDiffVal = (val: unknown) => {
    const d = val as Difficulty;
    const cfg = DIFF_CFG[d];
    if (!cfg) return <span className="text-sm">—</span>;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
      </span>
    );
  };

  const renderTags = (val: unknown) => {
    const arr = val as string[];
    if (!arr || arr.length === 0) return <span className="text-sm text-gray-400 italic">None selected</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {arr.map((s) => (
          <span key={s} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700">{s}</span>
        ))}
      </div>
    );
  };

  const renderAnswers = (val: unknown, side: 'old' | 'new') => {
    const answers = val as Answer[] | undefined;
    if (!answers || answers.length === 0) {
      return <p className="text-sm text-gray-400 italic">Essay — no predefined answers</p>;
    }
    const otherAnswers = side === 'old' ? q.answers : prev?.answers;
    return (
      <div className="space-y-1.5">
        {answers.map((opt, i) => {
          const otherOpt = otherAnswers?.[i];
          const ansChanged = otherOpt ? (opt.text !== otherOpt.text || opt.isCorrect !== otherOpt.isCorrect) : false;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm ${
                opt.isCorrect
                  ? 'border-teal-300 bg-teal-100/60 border-l-4'
                  : ansChanged
                  ? 'border-orange-200 bg-orange-50/50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <span className={`font-bold w-4 flex-shrink-0 text-xs ${opt.isCorrect ? 'text-teal-600' : 'text-gray-400'}`}>
                {LETTER[i]}
              </span>
              <span className={`flex-1 ${opt.isCorrect ? 'text-teal-800 font-semibold' : 'text-gray-700'}`}>{opt.text}</span>
              {opt.isCorrect && (
                <span className="text-[10px] font-semibold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full">✓ Correct</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Build the "current version" snapshot from the pending question itself (for single-view)
  const currentSnapshot: QuestionSnapshot = {
    type: q.type,
    difficulty: q.difficulty,
    text: q.text,
    subject: q.subject,
    chapters: q.chapters,
    learningObjectives: q.learningObjectives,
    answers: q.answers,
    editedAt: q.submittedAt,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-gray-900">Approval Request</h2>
                {hasPrev && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                    <GitCompare className="size-3" />Re-submitted
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <User className="size-3" />{q.submittedBy}
                <span>·</span>
                <Calendar className="size-3" />
                {new Date(q.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {q.usedInExams > 0 && (
                  <>
                    <span>·</span>
                    <BarChart2 className="size-3" />Used in {q.usedInExams} exam{q.usedInExams > 1 ? 's' : ''}
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="size-4" />
            </button>
          </div>

          {/* Column headers for diff mode */}
          {hasPrev && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700">Current version</span>
                <span className="text-xs text-red-400 ml-auto">{new Date(prev!.editedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-teal-700">Changed version</span>
                <span className="text-xs text-teal-400 ml-auto">{new Date(q.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {hasPrev && prev ? (
            <>
              {/* ── DIFF MODE: side by side ─────────────── */}

              {/* Question Type + Difficulty in one row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Left: old type + difficulty */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl p-3 border ${changed(prev.type, q.type) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Question Type" />
                    {renderTypeVal(prev.type)}
                    {changed(prev.type, q.type) && (
                      <p className="text-[10px] text-red-400 mt-1 flex items-center gap-0.5"><AlertTriangle className="size-3" />Changed</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-3 border ${changed(prev.difficulty, q.difficulty) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Difficulty" />
                    {renderDiffVal(prev.difficulty)}
                    {changed(prev.difficulty, q.difficulty) && (
                      <p className="text-[10px] text-red-400 mt-1 flex items-center gap-0.5"><AlertTriangle className="size-3" />Changed</p>
                    )}
                  </div>
                </div>
                {/* Right: new type + difficulty */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl p-3 border ${changed(prev.type, q.type) ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Question Type" />
                    {renderTypeVal(q.type)}
                    {changed(prev.type, q.type) && (
                      <p className="text-[10px] text-teal-500 mt-1 flex items-center gap-0.5"><CheckCircle className="size-3" />Updated</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-3 border ${changed(prev.difficulty, q.difficulty) ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Difficulty" />
                    {renderDiffVal(q.difficulty)}
                    {changed(prev.difficulty, q.difficulty) && (
                      <p className="text-[10px] text-teal-500 mt-1 flex items-center gap-0.5"><CheckCircle className="size-3" />Updated</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <DiffRow
                label="Question Text"
                oldVal={prev.text}
                newVal={q.text}
                render={renderText}
              />

              {/* Subject */}
              <DiffRow
                label="Subject"
                oldVal={prev.subject}
                newVal={q.subject}
                render={renderText}
              />

              {/* Chapters */}
              <DiffRow
                label="Chapter"
                oldVal={prev.chapters}
                newVal={q.chapters}
                render={renderTags}
              />

              {/* Learning Objectives */}
              <DiffRow
                label="Learning Objective"
                oldVal={prev.learningObjectives}
                newVal={q.learningObjectives}
                render={renderTags}
              />

              {/* Answers */}
              {q.type !== 'essay' && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={`rounded-xl p-3 border ${changed(prev.answers, q.answers) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Answers" />
                    {renderAnswers(prev.answers, 'old')}
                  </div>
                  <div className={`rounded-xl p-3 border ${changed(prev.answers, q.answers) ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100'}`}>
                    <FieldLabel label="Answers" />
                    {renderAnswers(q.answers, 'new')}
                  </div>
                </div>
              )}

              {/* Changed fields summary */}
              {(() => {
                const changedFields: string[] = [];
                if (changed(prev.type, q.type)) changedFields.push('Question Type');
                if (changed(prev.difficulty, q.difficulty)) changedFields.push('Difficulty');
                if (changed(prev.text, q.text)) changedFields.push('Question Text');
                if (changed(prev.subject, q.subject)) changedFields.push('Subject');
                if (changed(prev.chapters, q.chapters)) changedFields.push('Chapter');
                if (changed(prev.learningObjectives, q.learningObjectives)) changedFields.push('Learning Objectives');
                if (changed(prev.answers, q.answers)) changedFields.push('Answers');
                if (changedFields.length === 0) return null;
                return (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl mb-4">
                    <GitCompare className="size-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      <span className="font-semibold">{changedFields.length} field{changedFields.length > 1 ? 's' : ''} changed: </span>
                      {changedFields.join(', ')}
                    </p>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              {/* ── SINGLE VIEW (no previous version) ───── */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <FieldLabel label="Question Type" />
                  {renderTypeVal(q.type)}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <FieldLabel label="Difficulty" />
                  {renderDiffVal(q.difficulty)}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
                <FieldLabel label="Question Text" />
                <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <FieldLabel label="Subject" />
                  <p className="text-sm text-gray-700">{q.subject}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <FieldLabel label="Chapter" />
                  {renderTags(q.chapters)}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <FieldLabel label="Learning Objective" />
                  {renderTags(q.learningObjectives)}
                </div>
              </div>

              {q.answers && q.answers.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
                  <FieldLabel label="Answers" />
                  {renderAnswers(q.answers, 'new')}
                </div>
              )}

              {q.type === 'essay' && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
                  <FieldLabel label="Answers" />
                  <p className="text-sm text-gray-400 italic">Essay question — teacher-defined rubric, no predefined answers.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {!rejecting ? (
            <div className="flex items-center justify-between gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setRejecting(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  <XCircle className="size-4" />Reject
                </button>
                <button onClick={() => { onApprove(q.id); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors">
                  <CheckCircle className="size-4" />Approve & Add to Bank
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-500 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-700">Rejection reason (will be sent to teacher)</p>
              </div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="Explain why this question is being rejected..."
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none placeholder:text-gray-400" />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setRejecting(false); setReason(''); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={() => { onReject(q.id, reason); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                  <XCircle className="size-4" />Confirm Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pending card (compact, click to open detail) ─────────────────────────────

function PendingCard({ q, onClick }: { q: PendingQuestion; onClick: () => void }) {
  const typeInfo = TYPE_CFG[q.type];
  const diff = DIFF_CFG[q.difficulty];
  return (
    <button onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border border-gray-100 border-l-4 ${diff.border} shadow-sm hover:shadow-md hover:border-gray-200 transition-all px-5 py-4`}>
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${typeInfo.pill}`}>
          <typeInfo.icon className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{q.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.pill}`}>{typeInfo.label}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${diff.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />{diff.label}
            </span>
            {q.previousVersion && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                <GitCompare className="size-3" />Re-submitted
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1"><User className="size-3" />{q.submittedBy}</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="size-3" />{new Date(q.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{q.subject} · {q.chapters.join(', ')}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 mt-1">
          <span className="text-xs text-teal-600 font-medium flex items-center gap-1"><Eye className="size-3.5" />Review</span>
          <ChevronRight className="size-4 text-gray-300" />
        </div>
      </div>
    </button>
  );
}

// ─── Admin bank question detail modal ────────────────────────────────────────

function AdminQuestionDetailModal({
  question,
  onClose,
  onEdit,
}: {
  question: BankQuestion;
  onClose: () => void;
  onEdit: () => void;
}) {
  const typeInfo = TYPE_CFG[question.type];
  const difficultyInfo = DIFF_CFG[question.difficulty];

  const displayOptions = useMemo(() => {
    if (question.type === 'true-false') {
      return ['True', 'False'];
    }

    return question.options ?? [];
  }, [question.options, question.type]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="oes-dialog-overlay flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-question-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="oes-dialog-content question-detail-modal bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2
              id="admin-question-detail-title"
              className="text-xl font-semibold text-slate-900"
            >
              Question Detail
            </h2>

            <p className="mt-0.5 text-sm text-slate-500">
              Review the question content, classification, usage, and answer
              details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label="Close question detail"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold ${typeInfo.pill}`}
                >
                  {typeInfo.label}
                </span>

                <span
                  className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold ${difficultyInfo.pill}`}
                >
                  {difficultyInfo.label}
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                  ID {question.id}
                </span>
              </div>

              <p className="mt-4 text-lg font-medium leading-7 text-slate-900">
                {question.text}
              </p>
            </section>

            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {question.subject}
                </p>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Creator
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {question.createdBy}
                </p>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Used in Exams
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {question.usageCount}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Chapter
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {question.chapter || 'None'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Learning Objectives
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {question.learningObjectives?.length
                    ? question.learningObjectives.join(', ')
                    : 'None'}
                </p>
              </div>
            </section>

            {question.type !== 'essay' && displayOptions.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-3 text-sm font-semibold text-slate-900">
                  Answers
                </p>

                <div className="space-y-2">
                  {displayOptions.map((option, index) => {
                    const isCorrect = option === question.correctAnswer;

                    return (
                      <div
                        key={`${option}-${index}`}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          isCorrect
                            ? 'question-detail-option-row-correct'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {LETTER[index] ?? index + 1}
                        </span>

                        <span
                          className={`min-w-0 flex-1 ${
                            isCorrect
                              ? 'font-medium text-emerald-900'
                              : 'text-slate-700'
                          }`}
                        >
                          {option}
                        </span>

                        {isCorrect && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {question.type !== 'essay' && displayOptions.length === 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Answers
                </p>

                <p className="text-sm text-slate-500">
                  No answer options available.
                </p>
              </section>
            )}

            {question.type === 'essay' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Suggested Answer / Rubric
                </p>

                <p className="text-sm text-slate-500">
                  Essay questions do not contain predefined answers.
                </p>
              </section>
            )}

            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Department
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {question.department}
                </p>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Created At
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {question.createdAt}
                </p>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-medium text-white transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <Edit className="size-4" />
            Edit Question
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ─── Admin bank question editor modal ────────────────────────────────────────

interface AdminEditorOption {
  text: string;
  isCorrect: boolean;
}

function createEditorOptions(question: BankQuestion): AdminEditorOption[] {
  if (question.type === 'essay') {
    return [];
  }

  if (question.type === 'true-false') {
    return [
      {
        text: 'True',
        isCorrect: question.correctAnswer?.toLowerCase() === 'true',
      },
      {
        text: 'False',
        isCorrect: question.correctAnswer?.toLowerCase() === 'false',
      },
    ];
  }

  const sourceOptions =
    question.options && question.options.length >= 2
      ? question.options
      : ['', ''];

  return sourceOptions.map((option) => ({
    text: option,
    isCorrect: option === question.correctAnswer,
  }));
}

function AdminQuestionEditorModal({
  question,
  subjects,
  onClose,
  onSave,
}: {
  question: BankQuestion;
  subjects: SubjectMeta[];
  onClose: () => void;
  onSave: (question: BankQuestion) => void;
}) {
  const [questionType, setQuestionType] = useState<QType>(question.type);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    question.difficulty,
  );
  const [questionText, setQuestionText] = useState(question.text);
  const [subject, setSubject] = useState(question.subject);
  const [chapter, setChapter] = useState(question.chapter);
  const [learningObjectivesText, setLearningObjectivesText] = useState(
    question.learningObjectives?.join(', ') ?? '',
  );
  const [options, setOptions] = useState<AdminEditorOption[]>(
    createEditorOptions(question),
  );
  const [saveAttempted, setSaveAttempted] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!questionText.trim()) {
      errors.push('Question text is required.');
    }

    if (!subject) {
      errors.push('Subject is required.');
    }

    if (!chapter.trim()) {
      errors.push('Chapter is required.');
    }

    if (!difficulty) {
      errors.push('Difficulty is required.');
    }

    if (questionType === 'mcq' || questionType === 'matching') {
      const normalizedOptions = options.map((option) =>
        option.text.trim().toLowerCase(),
      );

      if (options.length < 2) {
        errors.push('At least two answer options are required.');
      }

      if (options.length > 8) {
        errors.push('A maximum of eight answer options is allowed.');
      }

      if (options.some((option) => !option.text.trim())) {
        errors.push('Answer options cannot be empty.');
      }

      if (
        normalizedOptions.filter(Boolean).length !==
        new Set(normalizedOptions.filter(Boolean)).size
      ) {
        errors.push('Answer options must be unique.');
      }

      if (options.filter((option) => option.isCorrect).length !== 1) {
        errors.push('Select exactly one correct answer.');
      }
    }

    if (questionType === 'true-false') {
      if (options.filter((option) => option.isCorrect).length !== 1) {
        errors.push('Select either True or False as the correct answer.');
      }
    }

    return errors;
  }, [
    chapter,
    difficulty,
    options,
    questionText,
    questionType,
    subject,
  ]);

  const handleTypeChange = (nextType: QType) => {
    setQuestionType(nextType);

    if (nextType === 'essay') {
      setOptions([]);
      return;
    }

    if (nextType === 'true-false') {
      setOptions([
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ]);
      return;
    }

    if (options.length < 2) {
      setOptions([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ]);
    }
  };

  const updateOptionText = (index: number, value: string) => {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text: value } : option,
      ),
    );
  };

  const selectCorrectOption = (index: number) => {
    setOptions((current) =>
      current.map((option, optionIndex) => ({
        ...option,
        isCorrect: optionIndex === index,
      })),
    );
  };

  const addOption = () => {
    setOptions((current) => {
      if (current.length >= 8) {
        return current;
      }

      return [...current, { text: '', isCorrect: false }];
    });
  };

  const removeOption = (index: number) => {
    setOptions((current) => {
      if (current.length <= 2) {
        return current;
      }

      const next = current.filter((_, optionIndex) => optionIndex !== index);

      if (!next.some((option) => option.isCorrect) && next.length > 0) {
        next[0] = {
          ...next[0],
          isCorrect: true,
        };
      }

      return next;
    });
  };

  const handleSubmit = () => {
    setSaveAttempted(true);

    if (validationErrors.length > 0) {
      return;
    }

    const cleanedLearningObjectives = learningObjectivesText
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const cleanedOptions =
      questionType === 'essay'
        ? []
        : options.map((option) => ({
            ...option,
            text: option.text.trim(),
          }));

    const correctOption = cleanedOptions.find(
      (option) => option.isCorrect,
    );

    onSave({
      ...question,
      type: questionType,
      difficulty,
      text: questionText.trim(),
      subject,
      chapter: chapter.trim(),
      learningObjectives: cleanedLearningObjectives,
      options:
        questionType === 'essay'
          ? undefined
          : cleanedOptions.map((option) => option.text),
      correctAnswer:
        questionType === 'essay' ? undefined : correctOption?.text,
    });
  };

  return createPortal(
    <div
      className="oes-dialog-overlay flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-question-editor-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="question-editor-modal bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2
              id="admin-question-editor-title"
              className="text-xl font-semibold text-slate-900"
            >
              Edit Question
            </h2>

            <p className="mt-0.5 text-sm text-slate-500">
              Update the question content, classification, and answer details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label="Close question editor"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <section className="space-y-4 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-gray-700">
                    Question Type *
                  </span>

                  <select
                    value={questionType}
                    onChange={(event) =>
                      handleTypeChange(event.target.value as QType)
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="true-false">True / False</option>
                    <option value="essay">Essay</option>
                    <option value="matching">Matching</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-gray-700">
                    Difficulty *
                  </span>

                  <select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as Difficulty)
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-gray-700">
                  Question Text *
                </span>

                <textarea
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  rows={4}
                  placeholder="Enter the question text..."
                  className={`w-full resize-none rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-teal-200 ${
                    saveAttempted && !questionText.trim()
                      ? 'border-red-300'
                      : 'border-gray-200 focus:border-teal-300'
                  }`}
                />
              </label>
            </section>

            <section className="space-y-4 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800">
                Classification
              </h3>

              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-gray-700">
                  Subject *
                </span>

                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className={`h-10 w-full rounded-lg border bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-teal-200 ${
                    saveAttempted && !subject
                      ? 'border-red-300'
                      : 'border-gray-200 focus:border-teal-300'
                  }`}
                >
                  <option value="" disabled>
                    Select subject
                  </option>

                  {subjects.map((subjectOption) => (
                    <option
                      key={subjectOption.code}
                      value={subjectOption.name}
                    >
                      {subjectOption.code} - {subjectOption.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-gray-700">
                    Chapter *
                  </span>

                  <input
                    type="text"
                    value={chapter}
                    onChange={(event) => setChapter(event.target.value)}
                    placeholder="Enter chapter"
                    className={`h-10 w-full rounded-lg border bg-gray-50 px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-teal-200 ${
                      saveAttempted && !chapter.trim()
                        ? 'border-red-300'
                        : 'border-gray-200 focus:border-teal-300'
                    }`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-gray-700">
                    Learning Objectives
                  </span>

                  <input
                    type="text"
                    value={learningObjectivesText}
                    onChange={(event) =>
                      setLearningObjectivesText(event.target.value)
                    }
                    placeholder="LO1, LO2, LO3"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                  />

                  <span className="block text-xs text-gray-400">
                    Separate multiple learning objectives with commas.
                  </span>
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  Answers
                </h3>

                {(questionType === 'mcq' ||
                  questionType === 'matching') && (
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={options.length >= 8}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    Add Option
                  </button>
                )}
              </div>

              {(questionType === 'mcq' ||
                questionType === 'matching') && (
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                        option.isCorrect
                          ? 'border-teal-300 bg-teal-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectCorrectOption(index)}
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          option.isCorrect
                            ? 'border-teal-500 bg-teal-500 text-white'
                            : 'border-gray-300 bg-white hover:border-teal-400'
                        }`}
                        aria-label={`Mark option ${index + 1} as correct`}
                      >
                        {option.isCorrect && (
                          <CheckCircle className="size-3" />
                        )}
                      </button>

                      <span
                        className={`w-5 shrink-0 text-center text-xs font-semibold ${
                          option.isCorrect
                            ? 'text-teal-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {LETTER[index] ?? index + 1}
                      </span>

                      <input
                        type="text"
                        value={option.text}
                        onChange={(event) =>
                          updateOptionText(index, event.target.value)
                        }
                        placeholder={`Option ${index + 1}`}
                        className={`h-10 min-w-0 flex-1 rounded-lg border bg-gray-50 px-3 text-sm outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-teal-200 ${
                          option.isCorrect
                            ? 'border-teal-200 text-teal-800'
                            : 'border-gray-200 text-gray-800 focus:border-teal-300'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={options.length <= 2}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove option ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {questionType === 'true-false' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {options.map((option, index) => (
                    <button
                      key={option.text}
                      type="button"
                      onClick={() => selectCorrectOption(index)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        option.isCorrect
                          ? 'border-teal-300 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-200 hover:bg-teal-50/50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        {option.text}

                        {option.isCorrect && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-600">
                            Correct
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {questionType === 'essay' && (
                <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Essay questions do not require predefined answer options.
                </p>
              )}
            </section>

            {saveAttempted && validationErrors.length > 0 && (
              <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />

                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Please fix the following problems
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                      {validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-medium text-white transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <Save className="size-4" />
            Save Changes
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ─── Bank question card ───────────────────────────────────────────────────────

function BankCard({
  q,
  index,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  q: BankQuestion;
  index: number;
  onView: (question: BankQuestion) => void;
  onEdit: (question: BankQuestion) => void;
  onDelete: (id: string) => void;
  onDuplicate: (question: BankQuestion) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const typeInfo = TYPE_CFG[q.type];
  const diff = DIFF_CFG[q.difficulty];

  return (
    <div
      className={`rounded-xl border border-gray-100 border-l-4 bg-white ${diff.border} shadow-sm transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
          {index + 1}
        </span>

        <div
          className={`shrink-0 rounded-lg p-1.5 ${typeInfo.pill}`}
        >
          <typeInfo.icon className="size-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-800">
            {q.text}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.pill}`}
            >
              {typeInfo.label}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${diff.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${diff.dot}`} />
              {diff.label}
            </span>

            <span className="text-xs text-gray-400">{q.chapter}</span>

            <span className="flex items-center gap-1 text-xs text-gray-400">
              <BarChart2 className="size-3" />
              Used {q.usageCount}×
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onView(q)}
            className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-teal-50 hover:text-teal-600"
            aria-label="View question"
            title="View question"
          >
            <Eye className="size-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
              aria-label="Question actions"
            >
              <MoreVertical className="size-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />

                <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onView(q);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="size-3.5" />
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onEdit(q);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="size-3.5" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDuplicate(q);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="size-3.5" />
                    Duplicate
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={() => {
                      onDelete(q.id);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminQuestionBankPage() {
  const [mainTab, setMainTab] = useState<'bank' | 'approvals'>('bank');
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>(MOCK_BANK);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [pending, setPending] = useState<PendingQuestion[]>(MOCK_PENDING);
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalDiff, setApprovalDiff] = useState('');
  const [approvalType, setApprovalType] = useState('');
  const [detailQuestion, setDetailQuestion] = useState<PendingQuestion | null>(null);
  const [viewQuestion, setViewQuestion] =
  useState<BankQuestion | null>(null);

  const [editingQuestion, setEditingQuestion] =
  useState<BankQuestion | null>(null);

  const subjectMeta = SUBJECTS.find((s) => s.name === selectedSubject);
  const subjectQuestions = bankQuestions.filter((q) => q.subject === selectedSubject);

  const filteredBank = subjectQuestions.filter((q) => {
    if (bankSearch && !q.text.toLowerCase().includes(bankSearch.toLowerCase()) && !q.chapter.toLowerCase().includes(bankSearch.toLowerCase())) return false;
    if (typeFilter && q.type !== typeFilter) return false;
    if (diffFilter && q.difficulty !== diffFilter) return false;
    return true;
  });

  const filteredPending = pending.filter((q) => {
    if (approvalSearch && !q.text.toLowerCase().includes(approvalSearch.toLowerCase()) && !q.subject.toLowerCase().includes(approvalSearch.toLowerCase())) return false;
    if (approvalType && q.type !== approvalType) return false;
    if (approvalDiff && q.difficulty !== approvalDiff) return false;
    return true;
  });

  const handleApprove = (id: string) => {
    setPending((p) => p.filter((q) => q.id !== id));
    toast.success('Question approved and added to the Question Bank.');
  };

  const handleReject = (id: string, reason: string) => {
    setPending((p) => p.filter((q) => q.id !== id));
    toast.error(`Question rejected.${reason ? ' Reason sent to teacher.' : ''}`);
  };

  const handleDeleteBank = (id: string) => {
    setBankQuestions((q) => q.filter((x) => x.id !== id));
    toast.success('Question deleted.');
  };

  const handleDuplicate = (q: BankQuestion) => {
    setBankQuestions((prev) => [
      { ...q, id: Date.now().toString(), text: q.text + ' (Copy)', usageCount: 0, createdAt: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
    toast.success('Question duplicated.');
  };

  const handleSaveBankQuestion = (updatedQuestion: BankQuestion) => {
  setBankQuestions((current) =>
    current.map((question) =>
      question.id === updatedQuestion.id
        ? updatedQuestion
        : question,
    ),
  );

  setEditingQuestion(null);
  toast.success('Question updated successfully.');
};

  const departments = Array.from(new Set(SUBJECTS.map((s) => s.dept)));

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50">
            <Database className="size-4 text-teal-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">Question Bank</h1>
            <p className="text-xs text-gray-400 leading-tight">Manage the central question library</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setMainTab('bank')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mainTab === 'bank' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Library className="size-3.5" />Question Bank
          </button>
          <button onClick={() => setMainTab('approvals')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mainTab === 'approvals' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <ClipboardCheck className="size-3.5" />Approval Requests
            {pending.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-600">{pending.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── BANK TAB ───────────────────────────────────── */}
      {mainTab === 'bank' && (
        <div className="flex-1 overflow-y-auto">
          {!selectedSubject && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-6">Select a subject to browse and manage questions.</p>
              <div className="space-y-6">
                {departments.map((dept) => {
                  const deptSubjects = SUBJECTS.filter((s) => s.dept === dept);
                  return (
                    <div key={dept}>
                      <div className="flex items-center gap-2 mb-3">
                        <GraduationCap className="size-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{dept}</span>
                        <div className="flex-1 h-px bg-gray-100 ml-1" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {deptSubjects.map((subj) => {
                          const count = bankQuestions.filter((q) => q.subject === subj.name).length;
                          return (
                            <button key={subj.code} onClick={() => setSelectedSubject(subj.name)}
                              className="group bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md hover:border-teal-200 transition-all">
                              <div className="flex items-start justify-between mb-3">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${subj.color}`}>
                                  <BookOpen className={`size-4 ${subj.iconColor}`} />
                                </div>
                                <ChevronRight className="size-3.5 text-gray-300 group-hover:text-teal-400 transition-colors" />
                              </div>
                              <h3 className="text-xs font-semibold text-gray-800 mb-0.5 leading-tight">{subj.name}</h3>
                              <p className="text-xs text-gray-400">{subj.code} · {count} questions</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSubject && (
            <div className="flex flex-col h-full">
              <div className="bg-white border-b border-gray-100 px-6 py-3 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setSelectedSubject('')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    <ArrowLeft className="size-4" />
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{subjectMeta?.dept}</span><ChevronRight className="size-3" />
                    <span className="text-gray-700 font-medium">{selectedSubject}</span>
                  </div>
                  <span className="ml-auto text-xs text-gray-400">{subjectMeta?.code}</span>
                </div>
                <div className="flex items-center gap-6 mb-3">
                  {[
                    { label: 'Total', val: subjectQuestions.length },
                    { label: 'MCQ', val: subjectQuestions.filter((q) => q.type === 'mcq').length },
                    { label: 'Essay', val: subjectQuestions.filter((q) => q.type === 'essay').length },
                    { label: 'True/False', val: subjectQuestions.filter((q) => q.type === 'true-false').length },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-semibold text-gray-800 leading-tight">{s.val}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-48 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                    <input type="text" placeholder="Search questions..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 placeholder:text-gray-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    {(['', 'mcq', 'true-false', 'essay'] as const).map((t) => (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${typeFilter === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-teal-50'}`}>
                        {t === '' ? 'All' : t === 'mcq' ? 'MCQ' : t === 'true-false' ? 'T/F' : 'Essay'}
                      </button>
                    ))}
                  </div>
                  <div className="h-5 w-px bg-gray-200" />
                  <div className="flex items-center gap-1">
                    {(['', 'easy', 'medium', 'hard'] as const).map((d) => {
                      const colors: Record<string, string> = { easy: 'bg-emerald-100 text-emerald-700 border-emerald-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', hard: 'bg-red-100 text-red-700 border-red-200' };
                      return (
                        <button key={d} onClick={() => setDiffFilter(d)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${diffFilter === d ? (d === '' ? 'bg-teal-600 text-white border-teal-600' : colors[d]) : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                          {d === '' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Upload className="size-3.5" />Import
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700">
                      <Plus className="size-4" />Add Question
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="max-w-4xl mx-auto space-y-2">
                  <p className="text-sm text-gray-400 mb-4"><span className="font-semibold text-gray-700">{filteredBank.length}</span> question{filteredBank.length !== 1 ? 's' : ''}</p>
                  {filteredBank.map((question, index) => (
  <BankCard
    key={question.id}
    q={question}
    index={index}
    onView={(selectedQuestion) => {
      setEditingQuestion(null);
      setViewQuestion(selectedQuestion);
    }}
    onEdit={(selectedQuestion) => {
      setViewQuestion(null);
      setEditingQuestion(selectedQuestion);
    }}
    onDelete={handleDeleteBank}
    onDuplicate={handleDuplicate}
  />
))}
                  {filteredBank.length === 0 && (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 mb-4">
                        <BookOpen className="size-6 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">No questions found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── APPROVALS TAB ──────────────────────────────── */}
      {mainTab === 'approvals' && (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-48 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input type="text" placeholder="Search pending questions..." value={approvalSearch} onChange={(e) => setApprovalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 placeholder:text-gray-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</span>
                {(['', 'mcq', 'true-false', 'essay'] as const).map((t) => (
                  <button key={t} onClick={() => setApprovalType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${approvalType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-teal-50'}`}>
                    {t === '' ? 'All' : t === 'mcq' ? 'MCQ' : t === 'true-false' ? 'T/F' : 'Essay'}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Level</span>
                {(['', 'easy', 'medium', 'hard'] as const).map((d) => {
                  const colors: Record<string, string> = { easy: 'bg-emerald-100 text-emerald-700 border-emerald-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', hard: 'bg-red-100 text-red-700 border-red-200' };
                  return (
                    <button key={d} onClick={() => setApprovalDiff(d)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${approvalDiff === d ? (d === '' ? 'bg-teal-600 text-white border-teal-600' : colors[d]) : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {d === '' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400"><span className="font-semibold text-gray-700">{filteredPending.length}</span> pending request{filteredPending.length !== 1 ? 's' : ''}</p>
              {filteredPending.length > 0 && (
                <button onClick={() => { filteredPending.forEach((q) => handleApprove(q.id)); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                  <CheckCircle className="size-3.5" />Approve All
                </button>
              )}
            </div>

            <div className="space-y-2">
              {filteredPending.map((q) => <PendingCard key={q.id} q={q} onClick={() => setDetailQuestion(q)} />)}
            </div>

            {filteredPending.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 mb-4">
                  <CheckCircle className="size-6 text-emerald-500" />
                </div>
                <p className="text-gray-600 font-medium">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">No pending approval requests.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {detailQuestion && (
  <ApprovalDetailModal
    q={detailQuestion}
    onClose={() => setDetailQuestion(null)}
    onApprove={(id) => {
      handleApprove(id);
      setDetailQuestion(null);
    }}
    onReject={(id, reason) => {
      handleReject(id, reason);
      setDetailQuestion(null);
    }}
  />
)}

{viewQuestion && (
  <AdminQuestionDetailModal
    question={viewQuestion}
    onClose={() => setViewQuestion(null)}
    onEdit={() => {
      const questionToEdit = viewQuestion;
      setViewQuestion(null);
      setEditingQuestion(questionToEdit);
    }}
  />
)}

{editingQuestion && (
  <AdminQuestionEditorModal
    question={editingQuestion}
    subjects={SUBJECTS}
    onClose={() => setEditingQuestion(null)}
    onSave={handleSaveBankQuestion}
  />
)}
    </div>
  );
}
