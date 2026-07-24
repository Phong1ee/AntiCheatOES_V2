import { useEffect } from 'react';
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
    pillTone:
      'border border-blue-300 bg-blue-50 text-blue-600',
  },
  'true-false': {
    label: 'True/False',
    pillTone:
      'border border-violet-300 bg-violet-50 text-violet-600',
  },
  essay: {
    label: 'Essay',
    pillTone:
      'border border-amber-300 bg-amber-50 text-amber-600',
  },
};

const difficultyConfig: Record<
  QuestionDifficulty,
  {
    label: string;
    pillTone: string;
  }
> = {
  easy: {
    label: 'Easy',
    pillTone:
      'border border-emerald-300 bg-emerald-50 text-emerald-600',
  },
  medium: {
    label: 'Medium',
    pillTone:
      'border border-amber-300 bg-amber-50 text-amber-600',
  },
  hard: {
    label: 'Hard',
    pillTone:
      'border border-red-300 bg-red-50 text-red-600',
  },
};

const statusConfig: Record<
  QuestionStatus,
  {
    label: string;
    pillTone: string;
  }
> = {
  draft: {
    label: 'Draft',
    pillTone:
      'border border-gray-300 bg-gray-50 text-gray-600',
  },
  pending: {
    label: 'Pending',
    pillTone:
      'border border-gray-300 bg-white text-gray-500',
  },
  approved: {
    label: 'Approved',
    pillTone:
      'border border-emerald-300 bg-emerald-50 text-emerald-600',
  },
  rejected: {
    label: 'Rejected',
    pillTone:
      'border border-red-300 bg-red-50 text-red-600',
  },
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
  const validValues = values
    .map((value) => value.trim())
    .filter(Boolean);

  return validValues.length > 0
    ? validValues.join(', ')
    : 'None';
}

export function QuestionDetailModal({
  open,
  activeTab,
  detail,
  loading,
  error,
  onClose,
}: QuestionDetailModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const typeInfo = detail
    ? typeConfig[detail.question_type]
    : null;

  const difficultyInfo =
    detail?.question_difficulties
      ? difficultyConfig[detail.question_difficulties]
      : null;

  const statusInfo =
    detail && activeTab === 'mine'
      ? statusConfig[detail.question_status]
      : null;

  const subjectText = detail?.subject
    ? `${detail.subject.subject_id} - ${detail.subject.subject_name}`
    : 'No Subject';

  const creatorText =
    detail?.creator?.full_name ?? 'Unknown';

  const chapterText = detail
    ? joinNames(
        detail.chapters.map(
          (chapter) => chapter.chapter_name,
        ),
      )
    : 'None';

  const learningObjectiveText = detail
    ? joinNames(
        detail.learning_objectives.map(
          (objective) => objective.lo_name,
        ),
      )
    : 'None';

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="z-[9999] flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between px-7 pb-5 pt-6">
          <div className="min-w-0 pr-4">
            <h2
              id="question-detail-title"
              className="text-xl font-semibold text-gray-900"
            >
              Question Detail
            </h2>

            <p className="mt-0.5 text-sm text-gray-400">
              Review taxonomy, status, usage, and authorized
              answer details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="-mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label="Close question detail"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-7 pb-7">
          {loading && (
            <div className="flex min-h-64 items-center justify-center rounded-xl bg-gray-50">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />

                <p className="text-sm font-medium text-gray-600">
                  Loading question detail...
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {detail &&
            !loading &&
            !error &&
            typeInfo && (
              <>
                {/* Question card */}
                <div className="rounded-xl bg-gray-50 p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${typeInfo.pillTone}`}
                    >
                      {typeInfo.label}
                    </span>

                    {difficultyInfo && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${difficultyInfo.pillTone}`}
                      >
                        {difficultyInfo.label}
                      </span>
                    )}

                    {statusInfo && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.pillTone}`}
                      >
                        {statusInfo.label}
                      </span>
                    )}

                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400">
                      ID {detail.question_id}
                    </span>
                  </div>

                  <p className="text-lg font-medium leading-snug text-gray-800">
                    {detail.question_text}
                  </p>

                  {detail.rejected_feedback && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Rejected reason:{' '}
                      {detail.rejected_feedback}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-5 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Subject
                    </p>

                    <p className="text-sm leading-snug text-gray-700">
                      {subjectText}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Creator
                    </p>

                    <p className="text-sm text-gray-700">
                      {creatorText}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Used in Exams
                    </p>

                    <p className="text-sm text-gray-700">
                      {detail.usage_count ?? 0}
                    </p>
                  </div>
                </div>

                {/* Chapters + Learning Objectives */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Chapters
                    </p>

                    <p className="text-sm text-gray-700">
                      {chapterText}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Learning Objectives
                    </p>

                    <p className="text-sm text-gray-700">
                      {learningObjectiveText}
                    </p>
                  </div>
                </div>

                {/* Answers */}
                {detail.question_type !== 'essay' &&
                  detail.options.length > 0 && (
                    <div className="rounded-xl bg-gray-50 p-5">
                      <p className="mb-3 text-sm font-semibold text-gray-800">
                        Answers
                      </p>

                      <div className="space-y-2">
                        {detail.options.map(
                          (option, index) => {
                            const isCorrect =
                              option.is_correct;

                            return (
                              <div
                                key={
                                  option.options_id ??
                                  index
                                }
                                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                                  isCorrect
                                    ? 'border-l-4 border-teal-400 bg-teal-50'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <span
                                  className={`w-5 shrink-0 font-semibold ${
                                    isCorrect
                                      ? 'text-teal-600'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {optionLetters[
                                    index
                                  ] ??
                                    index + 1}
                                </span>

                                <span
                                  className={`min-w-0 flex-1 ${
                                    isCorrect
                                      ? 'font-medium text-teal-800'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {option.options_text}
                                </span>

                                {isCorrect && (
                                  <span className="ml-auto shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-600">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                {detail.question_type !== 'essay' &&
                  detail.options.length === 0 && (
                    <div className="rounded-xl bg-gray-50 p-5">
                      <p className="mb-2 text-sm font-semibold text-gray-800">
                        Answers
                      </p>

                      <p className="text-sm text-gray-500">
                        No answer options available.
                      </p>
                    </div>
                  )}

                {/* Essay */}
                {detail.question_type === 'essay' && (
                  <div className="rounded-xl bg-gray-50 p-5">
                    <p className="mb-2 text-sm font-semibold text-gray-800">
                      Suggested Answer / Rubric
                    </p>

                    <p className="text-sm italic text-gray-500">
                      No suggested answer provided.
                    </p>
                  </div>
                )}
              </>
            )}
        </div>
      </div>
    </div>,
    document.body,
  );
}