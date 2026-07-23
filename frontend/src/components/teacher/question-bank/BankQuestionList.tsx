import { useState, type ReactNode } from 'react';
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
  Layers3,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { QuestionBankItem, QuestionDifficulty, QuestionType } from '../../../types/question-bank';

interface BankQuestionListProps {
  questions: QuestionBankItem[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (questionId: number) => void;
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
    iconTone: 'border-amber-200 bg-amber-50 text-amber-700',
    pillTone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  essay: {
    icon: FileText,
    label: 'Essay',
    iconTone: 'border-violet-200 bg-violet-50 text-violet-700',
    pillTone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
};

const difficultyLabels: Record<QuestionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const difficultyStyles: Record<QuestionDifficulty | 'no-difficulty', string> = {
  easy: 'border-l-emerald-500',
  medium: 'border-l-amber-500',
  hard: 'border-l-rose-500',
  'no-difficulty': 'border-l-slate-300',
};

const difficultyPillStyles: Record<QuestionDifficulty, string> = {
  easy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  hard: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-100/60">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-slate-500">None</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
          title={value}
        >
          {value}
        </span>
      ))}
    </div>
  );
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
}: BankQuestionListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-900">{total}</strong> question{total === 1 ? '' : 's'} found
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Page {page} of {totalPages}
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Loading questions...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm shadow-slate-100">
            <FileText className="h-5 w-5" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900">No questions found</p>
          <p className="mt-1 text-sm text-slate-500">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => {
            const type = typeConfig[question.question_type];
            const TypeIcon = type.icon;
            const difficulty = question.question_difficulties;
            const expanded = expandedId === question.question_id;
            const subject = question.subject
              ? `${question.subject.subject_id} - ${question.subject.subject_name}`
              : 'No Subject';
            const chapters = question.chapters.map((chapter) => chapter.chapter_name);
            const objectives = question.learning_objectives.map((objective) => objective.lo_name);

            return (
              <article
                key={question.question_id}
                className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm shadow-slate-100/60 transition hover:border-slate-300 hover:shadow-md ${
                  difficultyStyles[difficulty ?? 'no-difficulty']
                }`}
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${type.iconTone}`}>
                    <TypeIcon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-6 text-slate-900">{question.question_text}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${type.pillTone}`}
                      >
                        {type.label}
                        {typeof question.option_count === 'number' && question.question_type !== 'essay' && (
                          <span className="font-medium text-slate-500">{` ${question.option_count} opts`}</span>
                        )}
                      </span>

                      {difficulty && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${difficultyPillStyles[difficulty]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {difficultyLabels[difficulty]}
                        </span>
                      )}

                      {typeof question.usage_count === 'number' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                          <BarChart2 className="h-3.5 w-3.5" /> Used {question.usage_count}x
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
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:pt-1">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                      onClick={() => setExpandedId(expanded ? null : question.question_id)}
                      title="Show details"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Hide details' : 'Show details'}
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                      onClick={() => onView(question.question_id)}
                      title="View question"
                      aria-label="View question"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <MetaItem icon={BookOpen} label="Subject">
                        {subject}
                      </MetaItem>
                      <MetaItem icon={Calendar} label="Date">
                        {formatDate(question.updated_at ?? question.created_at)}
                      </MetaItem>
                      <MetaItem icon={BarChart2} label="Usage">
                        {`Used ${question.usage_count ?? 0} time${question.usage_count === 1 ? '' : 's'}`}
                      </MetaItem>
                      <MetaItem icon={Layers3} label="Chapters">
                        <Chips values={chapters} />
                      </MetaItem>
                      <MetaItem icon={Target} label="Learning Objectives">
                        <Chips values={objectives} />
                      </MetaItem>
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
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
