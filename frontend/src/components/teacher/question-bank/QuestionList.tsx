import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
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
  User,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { QuestionBankItem, QuestionBankTab, QuestionStatus, QuestionType } from '../../../types/question-bank';

type StatusFilter = QuestionStatus | 'all';

interface QuestionListProps {
  activeTab: QuestionBankTab;
  questions: QuestionBankItem[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  statusFilter?: StatusFilter;
  statusCounts?: Record<StatusFilter, number>;
  onStatusFilterChange?: (status: StatusFilter) => void;
  onNewQuestion?: () => void;
  onView: (questionId: number) => void;
  onEdit: (questionId: number) => void;
  onSubmit: (questionId: number) => void;
  onDelete: (questionId: number) => void;
}

const typeConfig: Record<QuestionType, { icon: LucideIcon; label: string; pill: string; border: string }> = {
  MCQ: {
    icon: CheckSquare,
    label: 'MCQ',
    pill: 'bg-blue-50 text-blue-600',
    border: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  'true-false': {
    icon: Circle,
    label: 'True/False',
    pill: 'bg-violet-50 text-violet-600',
    border: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  essay: {
    icon: FileText,
    label: 'Essay',
    pill: 'bg-amber-50 text-amber-600',
    border: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const bankDifficultyConfig = {
  easy: {
    label: 'Easy',
    pill: 'bg-emerald-50 text-emerald-600',
    border: 'border-l-emerald-400',
    dot: 'bg-emerald-400',
  },
  medium: {
    label: 'Medium',
    pill: 'bg-amber-50 text-amber-600',
    border: 'border-l-amber-400',
    dot: 'bg-amber-400',
  },
  hard: {
    label: 'Hard',
    pill: 'bg-red-50 text-red-600',
    border: 'border-l-red-400',
    dot: 'bg-red-400',
  },
};

const mineStatusConfig: Record<
  QuestionStatus,
  { label: string; icon: LucideIcon; pill: string; border: string; tab: string }
> = {
  draft: {
    label: 'Draft',
    icon: AlertCircle,
    pill: 'bg-gray-100 text-gray-600',
    border: 'border-l-gray-300',
    tab: 'bg-gray-100 text-gray-700',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    pill: 'bg-amber-50 text-amber-600',
    border: 'border-l-amber-400',
    tab: 'bg-amber-100 text-amber-700',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    pill: 'bg-emerald-50 text-emerald-600',
    border: 'border-l-emerald-400',
    tab: 'bg-emerald-100 text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    pill: 'bg-red-50 text-red-600',
    border: 'border-l-red-400',
    tab: 'bg-red-100 text-red-700',
  },
};

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCreatorName(question: QuestionBankItem) {
  const withCreator = question as QuestionBankItem & { creator?: { full_name?: string | null } | null };
  return withCreator.creator?.full_name ?? null;
}

function TaxonomyChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-gray-500">None</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((item, index) => (
            <Badge key={`${item}-${index}`} variant="outline" className="max-w-full truncate border-gray-200 bg-gray-50 text-gray-700">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function BankMetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="mb-0.5 font-medium text-gray-700">{label}</p>
        <p className="break-words">{value}</p>
      </div>
    </div>
  );
}

function getRejectedFeedback(question: QuestionBankItem) {
  const withFeedback = question as QuestionBankItem & { rejected_feedback?: string | null };
  return withFeedback.rejected_feedback ?? null;
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
        className="rounded-full"
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-full"
      >
        Next
      </Button>
    </div>
  );
}

export function QuestionList({
  activeTab,
  questions,
  loading,
  error,
  total,
  page,
  pageSize,
  statusFilter = 'all',
  statusCounts,
  onStatusFilterChange,
  onNewQuestion,
  onPageChange,
  onView,
  onEdit,
  onSubmit,
  onDelete,
}: QuestionListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (activeTab === 'bank') {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">0</span> questions found
            </p>
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
          </div>
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-teal-600" />
              <p className="text-sm font-medium text-gray-700">Loading questions...</p>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <Card className="rounded-xl border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-gray-700">{questions.length}</span> question{questions.length !== 1 ? 's' : ''} found
          </p>
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </p>
        </div>

        <div className="space-y-2">
          {questions.map((question) => {
            const typeInfo = typeConfig[question.question_type];
            const TypeIcon = typeInfo.icon;
            const difficulty = question.question_difficulties
              ? bankDifficultyConfig[question.question_difficulties]
              : bankDifficultyConfig.medium;
            const expanded = expandedId === question.question_id;
            const date = formatDate(question.updated_at ?? question.created_at);
            const creator = getCreatorName(question);
            const showOptionCount = question.question_type === 'MCQ' && typeof question.option_count === 'number';

            return (
              <div
                key={question.question_id}
                className={`group rounded-xl border border-gray-100 border-l-4 ${difficulty.border} bg-white shadow-sm transition-all duration-150 hover:shadow-md`}
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${typeInfo.pill}`}>
                    <TypeIcon className="size-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-800">
                      {question.question_text}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.pill}`}>
                        {typeInfo.label}
                        {showOptionCount && <span className="opacity-60">- {question.option_count} opts</span>}
                      </span>

                      {question.question_difficulties && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${difficulty.pill}`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${difficulty.dot}`} />
                          {difficulty.label}
                        </span>
                      )}

                      {typeof question.usage_count === 'number' && question.usage_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <BarChart2 className="size-3" />
                          Used in {question.usage_count} exam{question.usage_count === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : question.question_id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
                      title="Show details"
                    >
                      {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onView(question.question_id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-teal-50 hover:text-teal-600"
                      title="View question"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="space-y-4 border-t border-gray-100 pt-3">
                      <div className="grid grid-cols-1 gap-4 text-xs text-gray-500 md:grid-cols-3">
                        <BankMetaItem
                          icon={BookOpen}
                          label="Subject"
                          value={
                            question.subject
                              ? `${question.subject.subject_id} - ${question.subject.subject_name}`
                              : 'No Subject'
                          }
                        />
                        {creator && <BankMetaItem icon={User} label="Creator" value={creator} />}
                        {date && <BankMetaItem icon={Calendar} label="Date" value={date} />}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TaxonomyChips label="Chapters" values={question.chapters.map((chapter) => chapter.chapter_name)} />
                        <TaxonomyChips
                          label="Learning Objectives"
                          values={question.learning_objectives.map((lo) => lo.lo_name)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {questions.length === 0 && (
          <div className="py-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="size-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-600">No questions found</p>
            <p className="mt-1 text-sm text-gray-400">Try adjusting your filters or search term</p>
          </div>
        )}

        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>
    );
  }

  const statusCountText = statusFilter === 'all' ? total : questions.length;

  return (
    <div>
      <div className="mb-5 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          const statusInfo = tab.value === 'all' ? null : mineStatusConfig[tab.value];
          const count = statusCounts?.[tab.value];

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusFilterChange?.(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {typeof count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    active
                      ? tab.value === 'all'
                        ? 'bg-teal-100 text-teal-700'
                        : statusInfo?.tab ?? 'bg-gray-200 text-gray-600'
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-gray-700">{loading ? 0 : statusCountText}</span> question
          {statusCountText !== 1 ? 's' : ''}
        </p>
        {onNewQuestion && (
          <Button
            type="button"
            size="sm"
            onClick={onNewQuestion}
            className="gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus className="size-3.5" />
            New Question
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-teal-600" />
            <p className="text-sm font-medium text-gray-700">Loading questions...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <Card className="rounded-xl border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          <div className="space-y-2">
            {questions.map((question) => {
              const typeInfo = typeConfig[question.question_type];
              const TypeIcon = typeInfo.icon;
              const statusInfo = mineStatusConfig[question.question_status];
              const StatusIcon = statusInfo.icon;
              const difficulty = question.question_difficulties ? bankDifficultyConfig[question.question_difficulties] : null;
              const expanded = expandedId === question.question_id;
              const createdDate = formatDate(question.created_at);
              const updatedDate = formatDate(question.updated_at);
              const rejectedFeedback = getRejectedFeedback(question);
              const showOptionCount = question.question_type === 'MCQ' && typeof question.option_count === 'number';

              return (
                <div
                  key={question.question_id}
                  className={`group rounded-xl border border-gray-100 border-l-4 ${statusInfo.border} bg-white shadow-sm transition-all duration-150 hover:shadow-md`}
                >
                  <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                    <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${typeInfo.pill}`}>
                      <TypeIcon className="size-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-800">
                        {question.question_text}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.pill}`}>
                          {typeInfo.label}
                          {showOptionCount && <span className="opacity-60">- {question.option_count} opts</span>}
                        </span>

                        {difficulty && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${difficulty.pill}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${difficulty.dot}`} />
                            {difficulty.label}
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.pill}`}>
                          <StatusIcon className="size-3" />
                          {statusInfo.label}
                        </span>

                        {typeof question.usage_count === 'number' && question.usage_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <BarChart2 className="size-3" />
                            Used in {question.usage_count} exam{question.usage_count === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {question.question_status === 'rejected' && rejectedFeedback && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                          <XCircle className="mt-0.5 size-3.5 flex-shrink-0" />
                          <span>{rejectedFeedback}</span>
                        </div>
                      )}
                    </div>

                    <div className="ml-1 flex flex-shrink-0 items-center gap-1 sm:ml-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : question.question_id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
                        title="Show details"
                      >
                        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onView(question.question_id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-teal-50 hover:text-teal-600"
                        title="View question"
                      >
                        <Eye className="size-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="space-y-4 border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-1 gap-4 text-xs text-gray-500 md:grid-cols-3">
                          <BankMetaItem
                            icon={BookOpen}
                            label="Subject"
                            value={
                              question.subject
                                ? `${question.subject.subject_id} - ${question.subject.subject_name}`
                                : 'No Subject'
                            }
                          />
                          {createdDate && <BankMetaItem icon={Calendar} label="Created" value={createdDate} />}
                          {updatedDate && <BankMetaItem icon={Clock} label="Updated" value={updatedDate} />}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <TaxonomyChips label="Chapters" values={question.chapters.map((chapter) => chapter.chapter_name)} />
                          <TaxonomyChips
                            label="Learning Objectives"
                            values={question.learning_objectives.map((lo) => lo.lo_name)}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {question.permissions.can_edit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(question.question_id)}
                              className="gap-1.5 rounded-lg border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                          )}
                          {question.permissions.can_submit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSubmit(question.question_id)}
                              className="gap-1.5 rounded-lg border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                            >
                              <Send className="size-3.5" />
                              Submit for Approval
                            </Button>
                          )}
                          {question.permissions.can_resubmit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSubmit(question.question_id)}
                              className="gap-1.5 rounded-lg border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                            >
                              <Send className="size-3.5" />
                              Resubmit
                            </Button>
                          )}
                          {question.permissions.can_delete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 rounded-lg border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete question?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the question from your question list when it is not used by an exam.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDelete(question.question_id)}
                                    className="bg-red-600 hover:bg-red-700"
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
                              <span className="ml-1 flex items-center gap-1 text-xs text-amber-600">
                                <Clock className="size-3" />
                                Awaiting admin review
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {questions.length === 0 && (
            <div className="py-16 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                <FileText className="size-6 text-gray-400" />
              </div>
              <p className="font-medium text-gray-600">No questions here</p>
              <p className="mt-1 text-sm text-gray-400">
                {statusFilter === 'all' ? 'Start creating questions to add them to your bank.' : `You have no ${statusFilter} questions.`}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          </div>
        </>
      )}
    </div>
  );
}
