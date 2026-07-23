import { useState, type ReactNode } from 'react';
import {
  AlertCircle,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import type {
  QuestionBankItem,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '../../../types/question-bank';

type StatusFilter = QuestionStatus | 'all';

interface YourQuestionsListProps {
  questions: QuestionBankItem[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  statusFilter: StatusFilter;
  statusCounts?: Record<StatusFilter, number>;
  onStatusFilterChange: (status: StatusFilter) => void;
  onNewQuestion: () => void;
  onPageChange: (page: number) => void;
  onView: (questionId: number) => void;
  onEdit: (questionId: number) => void;
  onSubmit: (questionId: number) => void;
  onDelete: (questionId: number) => void;
}

const typeConfig: Record<
  QuestionType,
  {
    icon: LucideIcon;
    label: string;
    iconTone: string;
    pillTone: string;
  }
> = {
  MCQ: {
    icon: CheckSquare,
    label: 'MCQ',
    iconTone: 'border-sky-200 bg-sky-50 text-sky-700',
    pillTone: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  'true-false': {
    icon: Circle,
    label: 'True/False',
    iconTone: 'border-violet-200 bg-violet-50 text-violet-700',
    pillTone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  essay: {
    icon: FileText,
    label: 'Essay',
    iconTone: 'border-amber-200 bg-amber-50 text-amber-700',
    pillTone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const difficultyConfig: Record<
  QuestionDifficulty,
  {
    label: string;
    pillTone: string;
    borderTone: string;
    dotTone: string;
  }
> = {
  easy: {
    label: 'Easy',
    pillTone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    borderTone: 'border-l-emerald-400',
    dotTone: 'bg-emerald-400',
  },
  medium: {
    label: 'Medium',
    pillTone: 'border-amber-200 bg-amber-50 text-amber-700',
    borderTone: 'border-l-amber-400',
    dotTone: 'bg-amber-400',
  },
  hard: {
    label: 'Hard',
    pillTone: 'border-rose-200 bg-rose-50 text-rose-700',
    borderTone: 'border-l-rose-400',
    dotTone: 'bg-rose-400',
  },
};

const statusConfig: Record<
  QuestionStatus,
  {
    label: string;
    icon: LucideIcon;
    pillTone: string;
    borderTone: string;
    tabTone: string;
  }
> = {
  draft: {
    label: 'Draft',
    icon: AlertCircle,
    pillTone: 'border-slate-200 bg-slate-50 text-slate-600',
    borderTone: 'border-l-slate-300',
    tabTone: 'bg-slate-100 text-slate-700',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    pillTone: 'border-amber-200 bg-amber-50 text-amber-700',
    borderTone: 'border-l-amber-400',
    tabTone: 'bg-amber-100 text-amber-700',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    pillTone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    borderTone: 'border-l-emerald-400',
    tabTone: 'bg-emerald-100 text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    pillTone: 'border-rose-200 bg-rose-50 text-rose-700',
    borderTone: 'border-l-rose-400',
    tabTone: 'bg-rose-100 text-rose-700',
  },
};

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRejectedFeedback(question: QuestionBankItem): string | null {
  return (
    (question as QuestionBankItem & { rejected_feedback?: string | null })
      .rejected_feedback ?? null
  );
}

function joinValues(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'None';
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100/60">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-10 rounded-full border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-10 rounded-full border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Next
      </Button>
    </div>
  );
}

export function YourQuestionsList({
  questions,
  loading,
  error,
  total,
  page,
  pageSize,
  statusFilter,
  statusCounts,
  onStatusFilterChange,
  onNewQuestion,
  onPageChange,
  onView,
  onEdit,
  onSubmit,
  onDelete,
}: YourQuestionsListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const statusCountText = statusFilter === 'all' ? total : questions.length;

  return (
    <section className="space-y-4" aria-label="Your questions">
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl bg-slate-100 p-1">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          const count = statusCounts?.[tab.value];
          const statusInfo = tab.value === 'all' ? null : statusConfig[tab.value];

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => onStatusFilterChange(tab.value)}
            >
              <span>{tab.label}</span>
              {typeof count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    active
                      ? tab.value === 'all'
                        ? 'bg-teal-100 text-teal-700'
                        : statusInfo?.tabTone ?? 'bg-slate-200 text-slate-600'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{loading ? 0 : statusCountText}</span>{' '}
          question{statusCountText !== 1 ? 's' : ''}
        </p>

        <Button
          type="button"
          size="sm"
          onClick={onNewQuestion}
          className="h-10 gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Question
        </Button>
      </div>

      {loading && (
        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-sm font-medium text-slate-700">Loading questions...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="space-y-3">
            {questions.map((question) => {
              const typeInfo = typeConfig[question.question_type];
              const TypeIcon = typeInfo.icon;
              const statusInfo = statusConfig[question.question_status];
              const StatusIcon = statusInfo.icon;
              const difficulty = question.question_difficulties
                ? difficultyConfig[question.question_difficulties]
                : null;
              const expanded = expandedId === question.question_id;
              const rejectedFeedback = getRejectedFeedback(question);
              const createdDate = formatDate(question.created_at);
              const updatedDate = formatDate(question.updated_at);
              const chapterText = joinValues(
                question.chapters.map((chapter) => chapter.chapter_name),
              );
              const loText = joinValues(
                question.learning_objectives.map((lo) => lo.lo_name),
              );
              const showOptionCount =
                question.question_type === 'MCQ' &&
                typeof question.option_count === 'number';

              return (
                <article
                  key={question.question_id}
                  className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm shadow-slate-100/60 transition hover:border-slate-300 hover:shadow-md ${statusInfo.borderTone}`}
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${typeInfo.iconTone}`}
                    >
                      <TypeIcon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-6 text-slate-900">
                        {question.question_text}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${typeInfo.pillTone}`}
                        >
                          {typeInfo.label}
                          {showOptionCount && (
                            <span className="font-medium text-slate-500">
                              {' '}
                              · {question.option_count} opts
                            </span>
                          )}
                        </span>

                        {difficulty && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${difficulty.pillTone}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${difficulty.dotTone}`} />
                            {difficulty.label}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.pillTone}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </span>

                        {typeof question.usage_count === 'number' &&
                          question.usage_count > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                              <BarChart2 className="h-3.5 w-3.5" />
                              Used in {question.usage_count} exam
                              {question.usage_count === 1 ? '' : 's'}
                            </span>
                          )}

                        {question.subject && (
                          <span
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                            title={question.subject.subject_name}
                          >
                            #{question.subject.subject_id}
                          </span>
                        )}
                      </div>

                      {question.question_status === 'rejected' &&
                        rejectedFeedback && (
                          <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{rejectedFeedback}</span>
                          </div>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : question.question_id)
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                        title="Show details"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Collapse question' : 'Expand question'}
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onView(question.question_id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-600 transition hover:border-teal-300 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        aria-label="View question"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-500 md:grid-cols-3">
                          <MetaItem
                            icon={BookOpen}
                            label="Subject"
                            value={
                              question.subject
                                ? `${question.subject.subject_id} - ${question.subject.subject_name}`
                                : 'No Subject'
                            }
                          />
                          {createdDate && (
                            <MetaItem icon={Calendar} label="Created" value={createdDate} />
                          )}
                          {updatedDate && (
                            <MetaItem icon={Calendar} label="Updated" value={updatedDate} />
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100/60">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Chapters
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {chapterText}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100/60">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Learning Objectives
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {loText}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {question.permissions.can_edit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(question.question_id)}
                              className="h-10 rounded-full border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                          {question.permissions.can_submit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSubmit(question.question_id)}
                              className="h-10 rounded-full border-teal-200 bg-teal-50 px-4 text-xs font-medium text-teal-700 hover:bg-teal-100"
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Submit for Approval
                            </Button>
                          )}
                          {question.permissions.can_resubmit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSubmit(question.question_id)}
                              className="h-10 rounded-full border-teal-200 bg-teal-50 px-4 text-xs font-medium text-teal-700 hover:bg-teal-100"
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Resubmit
                            </Button>
                          )}
                          {question.permissions.can_delete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 rounded-full border-rose-200 px-4 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete question?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the question from your list when it is not used by an exam.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDelete(question.question_id)}
                                    className="bg-rose-600 hover:bg-rose-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {question.question_status === 'pending' &&
                            !question.permissions.can_edit &&
                            !question.permissions.can_submit &&
                            !question.permissions.can_resubmit &&
                            !question.permissions.can_delete && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                <Clock className="h-3.5 w-3.5" />
                                Awaiting admin review
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-medium text-slate-600">No questions here</p>
              <p className="mt-1 text-sm text-slate-400">
                {statusFilter === 'all'
                  ? 'Start creating questions to add them to your bank.'
                  : `You have no ${statusFilter} questions.`}
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
