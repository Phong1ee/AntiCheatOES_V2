import { useState } from 'react';
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
    iconTone: 'border-blue-100 bg-blue-50 text-blue-600',
    pillTone: 'bg-blue-50 text-blue-600',
  },
  'true-false': {
    icon: Circle,
    label: 'True/False',
    iconTone: 'border-violet-100 bg-violet-50 text-violet-600',
    pillTone: 'bg-violet-50 text-violet-600',
  },
  essay: {
    icon: FileText,
    label: 'Essay',
    iconTone: 'border-amber-100 bg-amber-50 text-amber-600',
    pillTone: 'bg-amber-50 text-amber-600',
  },
};

const difficultyConfig: Record<
  QuestionDifficulty,
  {
    label: string;
    pillTone: string;
    dotTone: string;
  }
> = {
  easy: {
    label: 'Easy',
    pillTone: 'bg-emerald-50 text-emerald-600',
    dotTone: 'bg-emerald-500',
  },
  medium: {
    label: 'Medium',
    pillTone: 'bg-amber-50 text-amber-600',
    dotTone: 'bg-amber-500',
  },
  hard: {
    label: 'Hard',
    pillTone: 'bg-rose-50 text-rose-600',
    dotTone: 'bg-rose-500',
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
    pillTone: 'bg-gray-100 text-gray-600',
    borderTone: 'border-l-gray-300',
    tabTone: 'bg-gray-100 text-gray-700',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    pillTone: 'bg-amber-50 text-amber-600',
    borderTone: 'border-l-amber-400',
    tabTone: 'bg-amber-100 text-amber-700',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    pillTone: 'bg-emerald-50 text-emerald-600',
    borderTone: 'border-l-emerald-400',
    tabTone: 'bg-emerald-100 text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    pillTone: 'bg-rose-50 text-rose-600',
    borderTone: 'border-l-rose-400',
    tabTone: 'bg-rose-100 text-rose-700',
  },
};

const statusTabs: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function getRejectedFeedback(
  question: QuestionBankItem,
): string | null {
  return (
    (
      question as QuestionBankItem & {
        rejected_feedback?: string | null;
      }
    ).rejected_feedback ?? null
  );
}

function getDisplayStatus(question: QuestionBankItem): QuestionStatus {
  if (question.question_status !== 'approved') return question.question_status;
  if (question.has_pending_revision) return 'pending';
  return question.revision_rejection_reason ? 'rejected' : 'approved';
}

function getChapterText(question: QuestionBankItem): string {
  const chapters = question.chapters
    .map((chapter) => chapter.chapter_name)
    .filter(Boolean);

  return chapters.length > 0 ? chapters.join(', ') : 'None';
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
        className="h-10 rounded-full border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Previous
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="h-10 rounded-full border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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

  const statusCountText =
    statusFilter === 'all' ? total : questions.length;

  return (
    <section className="space-y-4" aria-label="Your questions">
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          const count = statusCounts?.[tab.value];

          const statusInfo =
            tab.value === 'all'
              ? null
              : statusConfig[tab.value];

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() =>
                onStatusFilterChange(tab.value)
              }
            >
              <span>{tab.label}</span>

              {typeof count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    active
                      ? tab.value === 'all'
                        ? 'bg-teal-100 text-teal-700'
                        : statusInfo?.tabTone ??
                          'bg-gray-200 text-gray-600'
                      : 'bg-gray-200 text-gray-500'
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
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-gray-700">
            {loading ? 0 : statusCountText}
          </span>{' '}
          question{statusCountText !== 1 ? 's' : ''}
        </p>

        <Button
          type="button"
          size="sm"
          onClick={onNewQuestion}
          className="h-10 gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Question
        </Button>
      </div>

      {loading && (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />

            <p className="text-sm font-medium text-gray-700">
              Loading questions...
            </p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="space-y-2">
            {questions.map((question) => {
              const typeInfo =
                typeConfig[question.question_type];

              const TypeIcon = typeInfo.icon;

              const displayStatus = getDisplayStatus(question);

              const statusInfo = statusConfig[displayStatus];

              const StatusIcon = statusInfo.icon;

              const difficulty =
                question.question_difficulties
                  ? difficultyConfig[
                      question.question_difficulties
                    ]
                  : null;

              const expanded =
                expandedId === question.question_id;

              const rejectedFeedback =
                getRejectedFeedback(question);

              const chapter = getChapterText(question);

              const subject = question.subject
                ? `${question.subject.subject_id} - ${question.subject.subject_name}`
                : 'No Subject';

              const createdAt = formatDate(
                question.created_at,
              );

              const showOptionCount =
                typeof question.option_count === 'number' &&
                question.question_type !== 'essay';

              /*
               * Pending được mở quyền hiển thị Edit/Delete ở frontend.
               * Khi backend được cập nhật, permission trả về true thì
               * biểu thức này vẫn hoạt động bình thường.
               */
              const isPending = displayStatus === 'pending';

              const canEdit =
                displayStatus !== 'approved' &&
                (question.permissions.can_edit || isPending);

              const canDelete = question.permissions.can_delete;

              return (
                <article
                  key={question.question_id}
                  className={`overflow-hidden rounded-xl border border-gray-200 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${statusInfo.borderTone}`}
                >
                  <div className="flex items-start gap-3 px-5 py-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${typeInfo.iconTone}`}
                    >
                      <TypeIcon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-5 text-gray-800">
                        {question.question_text}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeInfo.pillTone}`}
                        >
                          {typeInfo.label}

                          {showOptionCount && (
                            <span className="ml-1 text-current opacity-70">
                              · {question.option_count} opts
                            </span>
                          )}
                        </span>

                        {difficulty && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${difficulty.pillTone}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${difficulty.dotTone}`}
                            />

                            {difficulty.label}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.pillTone}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>

                        {typeof question.usage_count ===
                          'number' &&
                          question.usage_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                              <BarChart2 className="h-3 w-3" />

                              Used in {question.usage_count}{' '}
                              {question.usage_count === 1
                                ? 'exam'
                                : 'exams'}
                            </span>
                          )}

                        {question.subject && (
                          <span
                            className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-400"
                            title={
                              question.subject.subject_name
                            }
                          >
                            #{question.subject.subject_id}
                          </span>
                        )}
                      </div>

                      {displayStatus === 'rejected' &&
                        rejectedFeedback && (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                            <span>{rejectedFeedback}</span>
                          </div>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(
                            expanded
                              ? null
                              : question.question_id,
                          )
                        }
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                          expanded
                            ? 'border-gray-800 bg-white text-gray-700'
                            : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                        }`}
                        title="Show details"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? 'Collapse question'
                            : 'Expand question'
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onView(question.question_id)
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-teal-50 hover:text-teal-600"
                        aria-label="View question"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div className="flex items-start gap-2">
                          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">
                              Subject
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-gray-500">
                              {subject}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">
                              Chapter
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-gray-500">
                              {chapter}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">
                              Created
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-gray-500">
                              {createdAt}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              onEdit(question.question_id)
                            }
                            className="h-9 rounded-lg border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        )}

                        {question.permissions.can_submit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              onSubmit(
                                question.question_id,
                              )
                            }
                            className="h-9 rounded-lg border-teal-200 bg-teal-50 px-3 text-xs font-medium text-teal-700 hover:bg-teal-100"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Submit for Approval
                          </Button>
                        )}

                        {question.permissions
                          .can_resubmit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              onSubmit(
                                question.question_id,
                              )
                            }
                            className="h-9 rounded-lg border-teal-200 bg-teal-50 px-3 text-xs font-medium text-teal-700 hover:bg-teal-100"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Resubmit
                          </Button>
                        )}

                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-lg border-rose-200 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>

                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {isPending
                                    ? 'Withdraw and delete this question?'
                                    : 'Delete question?'}
                                </AlertDialogTitle>

                                <AlertDialogDescription>
                                  {isPending
                                    ? 'This question is currently awaiting admin review. Deleting it will withdraw the pending submission and remove the question.'
                                    : 'This removes the question from your list when it is not used by an exam.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Cancel
                                </AlertDialogCancel>

                                <AlertDialogAction
                                  onClick={() =>
                                    onDelete(
                                      question.question_id,
                                    )
                                  }
                                  className="bg-rose-600 hover:bg-rose-700"
                                >
                                  {isPending
                                    ? 'Withdraw & Delete'
                                    : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                            <Clock className="h-3.5 w-3.5" />
                            Awaiting admin review
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>

              <p className="font-medium text-gray-600">
                No questions here
              </p>

              <p className="mt-1 text-sm text-gray-400">
                {statusFilter === 'all'
                  ? 'Start creating questions to add them to your bank.'
                  : `You have no ${statusFilter} questions.`}
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                Page {page} of {totalPages}
              </p>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
