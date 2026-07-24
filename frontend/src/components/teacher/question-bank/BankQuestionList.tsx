import { useState } from 'react';
import {
  BarChart2,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  FileText,
  Pencil,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  QuestionBankItem,
  QuestionDifficulty,
  QuestionType,
} from '../../../types/question-bank';

interface BankQuestionListProps {
  questions: QuestionBankItem[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (questionId: number) => void;
  onEdit: (questionId: number) => void;
}

type QuestionWithCreator = QuestionBankItem & {
  created_by_name?: string | null;
  creator_name?: string | null;
  created_by?:
    | string
    | {
        full_name?: string | null;
        name?: string | null;
      }
    | null;
};

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
    borderTone: string;
    pillTone: string;
    dotTone: string;
  }
> = {
  easy: {
    label: 'Easy',
    borderTone: 'border-l-emerald-400',
    pillTone: 'bg-emerald-50 text-emerald-600',
    dotTone: 'bg-emerald-500',
  },
  medium: {
    label: 'Medium',
    borderTone: 'border-l-amber-400',
    pillTone: 'bg-amber-50 text-amber-600',
    dotTone: 'bg-amber-500',
  },
  hard: {
    label: 'Hard',
    borderTone: 'border-l-rose-400',
    pillTone: 'bg-rose-50 text-rose-600',
    dotTone: 'bg-rose-500',
  },
};

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

function getCreatorName(question: QuestionBankItem): string {
  const value = question as QuestionWithCreator;

  if (value.created_by_name) {
    return value.created_by_name;
  }

  if (value.creator_name) {
    return value.creator_name;
  }

  if (typeof value.created_by === 'string') {
    return value.created_by;
  }

  if (value.created_by?.full_name) {
    return value.created_by.full_name;
  }

  if (value.created_by?.name) {
    return value.created_by.name;
  }

  return 'Unknown';
}

function getChapterText(question: QuestionBankItem): string {
  const chapters = question.chapters
    .map((chapter) => chapter.chapter_name)
    .filter(Boolean);

  return chapters.length > 0 ? chapters.join(', ') : 'None';
}

export function BankQuestionList({
  questions,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
  onEdit,
}: BankQuestionListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          <strong className="font-semibold text-gray-700">{total}</strong>{' '}
          question{total === 1 ? '' : 's'} found
        </p>

        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Page {page} of {totalPages}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-teal-500"
              aria-hidden="true"
            />

            <p className="text-sm font-medium">Loading questions...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
            <FileText className="h-5 w-5" />
          </div>

          <p className="mt-4 text-base font-semibold text-gray-800">
            No questions found
          </p>

          <p className="mt-1 text-sm text-gray-400">
            Try adjusting your filters or search term
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((question) => {
            const type = typeConfig[question.question_type];
            const TypeIcon = type.icon;
            const difficulty = question.question_difficulties;
            const difficultyInfo = difficulty
              ? difficultyConfig[difficulty]
              : null;

            const expanded = expandedId === question.question_id;
            const chapter = getChapterText(question);
            const creator = getCreatorName(question);
            const createdAt = formatDate(
              question.updated_at ?? question.created_at,
            );

            return (
              <article
                key={question.question_id}
                className={`overflow-hidden rounded-xl border border-gray-200 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${
                  difficultyInfo?.borderTone ?? 'border-l-gray-300'
                }`}
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${type.iconTone}`}
                  >
                    <TypeIcon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-5 text-gray-800">
                      {question.question_text}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${type.pillTone}`}
                      >
                        {type.label}

                        {typeof question.option_count === 'number' &&
                          question.question_type !== 'essay' && (
                            <span className="ml-1 text-current opacity-70">
                              · {question.option_count} opts
                            </span>
                          )}
                      </span>

                      {difficultyInfo && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${difficultyInfo.pillTone}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${difficultyInfo.dotTone}`}
                          />

                          {difficultyInfo.label}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <BarChart2 className="h-3 w-3" />
                        Used {question.usage_count ?? 0}×
                      </span>

                      {question.subject && (
                        <span
                          className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-400"
                          title={question.subject.subject_name}
                        >
                          #{question.subject.subject_id}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(
                          expanded ? null : question.question_id,
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
                        expanded ? 'Hide details' : 'Show details'
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
                      onClick={() => onView(question.question_id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-teal-50 hover:text-teal-600"
                      title="View question"
                      aria-label="View question"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {question.permissions.can_edit && (
                      <button
                        type="button"
                        onClick={() => onEdit(question.question_id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-teal-50 hover:text-teal-600"
                        title="Edit question"
                        aria-label="Edit question"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700">
                            Created by
                          </p>

                          <p className="mt-0.5 text-xs leading-5 text-gray-500">
                            {creator}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />

                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700">
                            Date
                          </p>

                          <p className="mt-0.5 text-xs leading-5 text-gray-500">
                            {createdAt}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>

          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
