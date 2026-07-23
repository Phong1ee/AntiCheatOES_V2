import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import type {
  QuestionBankTab,
  QuestionDetail,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '../../../types/question-bank';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const typeConfig: Record<
  QuestionType,
  {
    label: string;
    pillTone: string;
  }
> = {
  MCQ: {
    label: 'MCQ',
    pillTone: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  'true-false': {
    label: 'True/False',
    pillTone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  essay: {
    label: 'Essay',
    pillTone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const difficultyConfig: Record<
  QuestionDifficulty,
  {
    label: string;
    pillTone: string;
  }
> = {
  easy: { label: 'Easy', pillTone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  medium: { label: 'Medium', pillTone: 'border-amber-200 bg-amber-50 text-amber-700' },
  hard: { label: 'Hard', pillTone: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const statusConfig: Record<
  QuestionStatus,
  {
    label: string;
    pillTone: string;
  }
> = {
  draft: { label: 'Draft', pillTone: 'border-slate-200 bg-slate-50 text-slate-600' },
  pending: { label: 'Pending', pillTone: 'border-amber-200 bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', pillTone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', pillTone: 'border-rose-200 bg-rose-50 text-rose-700' },
};

interface QuestionDetailModalProps {
  open: boolean;
  activeTab: QuestionBankTab;
  detail: QuestionDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function joinNames(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'None';
}

export function QuestionDetailModal({
  open,
  activeTab,
  detail,
  loading,
  error,
  onClose,
}: QuestionDetailModalProps) {
  if (!open) return null;

  const typeInfo = detail ? typeConfig[detail.question_type] : null;
  const difficultyInfo = detail?.question_difficulties
    ? difficultyConfig[detail.question_difficulties]
    : null;
  const statusInfo =
    detail && activeTab === 'mine' ? statusConfig[detail.question_status] : null;

  return createPortal(
      <div
      className="oes-dialog-overlay flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="oes-dialog-content question-detail-modal bg-white">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 id="question-detail-title" className="text-xl font-semibold text-slate-900">
              Question Detail
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Review taxonomy, status, usage, and authorized answer details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="Close question detail"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm font-medium text-slate-700">
                  Loading question detail...
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {detail && !loading && !error && typeInfo && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${typeInfo.pillTone}`}
                  >
                    {typeInfo.label}
                  </span>

                  {difficultyInfo && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${difficultyInfo.pillTone}`}
                    >
                      {difficultyInfo.label}
                    </span>
                  )}

                  {statusInfo && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.pillTone}`}
                    >
                      {statusInfo.label}
                    </span>
                  )}

                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                    ID {detail.question_id}
                  </span>
                </div>

                <p className="mt-4 text-lg font-medium leading-7 text-slate-900">
                  {detail.question_text}
                </p>

                {detail.rejected_feedback && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Rejected reason: {detail.rejected_feedback}
                  </div>
                )}
              </section>

              <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Subject
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {detail.subject
                      ? `${detail.subject.subject_id} - ${detail.subject.subject_name}`
                      : 'No Subject'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Creator
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {detail.creator?.full_name ?? 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Used in Exams
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {detail.usage_count ?? 0}
                  </p>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Chapters
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {joinNames(detail.chapters.map((chapter) => chapter.chapter_name))}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Learning Objectives
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {joinNames(detail.learning_objectives.map((lo) => lo.lo_name))}
                  </p>
                </div>
              </section>

              {detail.question_type !== 'essay' && detail.options.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-3 text-sm font-semibold text-slate-900">Answers</p>
                  <div className="space-y-2">
                    {detail.options.map((option, index) => {
                      const correct = option.is_correct;

                      return (
                        <div
                          key={option.options_id ?? index}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                            correct
                              ? 'question-detail-option-row-correct'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              correct
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            {optionLetters[index] ?? index + 1}
                          </span>
                          <span
                            className={`min-w-0 flex-1 ${
                              correct
                                ? 'font-medium text-emerald-900'
                                : 'text-slate-700'
                            }`}
                          >
                            {option.options_text}
                          </span>
                          {correct && (
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

              {detail.question_type !== 'essay' && detail.options.length === 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-2 text-sm font-semibold text-slate-900">Answers</p>
                  <p className="text-sm text-slate-500">No answer options available.</p>
                </section>
              )}

              {detail.question_type === 'essay' && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    Suggested Answer / Rubric
                  </p>
                  <p className="text-sm text-slate-500">
                    No suggested answer provided.
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
