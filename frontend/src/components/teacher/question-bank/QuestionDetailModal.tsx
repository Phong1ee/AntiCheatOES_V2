import { Loader2, X } from 'lucide-react';
import type {
  QuestionBankTab,
  QuestionDetail,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '../../../types/question-bank';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const typeConfig: Record<QuestionType, { label: string; className: string }> = {
  MCQ: { label: 'MCQ', className: 'mcq' },
  'true-false': { label: 'True/False', className: 'true-false' },
  essay: { label: 'Essay', className: 'essay' },
};

const difficultyConfig: Record<QuestionDifficulty, { label: string; className: string }> = {
  easy: { label: 'Easy', className: 'easy' },
  medium: { label: 'Medium', className: 'medium' },
  hard: { label: 'Hard', className: 'hard' },
};

const statusConfig: Record<QuestionStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'draft' },
  pending: { label: 'Pending', className: 'pending' },
  approved: { label: 'Approved', className: 'approved' },
  rejected: { label: 'Rejected', className: 'rejected' },
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
  const statusInfo = detail && activeTab === 'mine'
    ? statusConfig[detail.question_status]
    : null;

  return (
    <div
      className="qb-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qb-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="qb-detail-modal">
        <header className="qb-detail-header">
          <div>
            <h2 id="qb-detail-title" className="qb-detail-title">Question Detail</h2>
            <p className="qb-detail-subtitle">
              Review taxonomy, status, usage, and authorized answer details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="qb-detail-close"
            aria-label="Close question detail"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="qb-detail-body">
          {loading && (
            <div className="qb-detail-loading">
              <Loader2 aria-hidden="true" />
              <p>Loading question detail...</p>
            </div>
          )}

          {error && !loading && (
            <div className="qb-detail-error">{error}</div>
          )}

          {detail && !loading && !error && typeInfo && (
            <>
              <section className="qb-detail-question-card">
                <div className="qb-detail-badges">
                  <span className={`qb-detail-pill type-${typeInfo.className}`}>
                    {typeInfo.label}
                  </span>

                  {difficultyInfo && (
                    <span className={`qb-detail-pill difficulty-${difficultyInfo.className}`}>
                      {difficultyInfo.label}
                    </span>
                  )}

                  {statusInfo && (
                    <span className={`qb-detail-pill status-${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  )}

                  <span className="qb-detail-pill qb-detail-id">
                    ID {detail.question_id}
                  </span>
                </div>

                <p className="qb-detail-question-text">{detail.question_text}</p>

                {detail.rejected_feedback && (
                  <div className="qb-detail-rejected">
                    Rejected reason: {detail.rejected_feedback}
                  </div>
                )}
              </section>

              <section className="qb-detail-metadata-card">
                <div className="qb-detail-field">
                  <p className="qb-detail-field-label">Subject</p>
                  <p className="qb-detail-field-value">
                    {detail.subject
                      ? `${detail.subject.subject_id} - ${detail.subject.subject_name}`
                      : 'No Subject'}
                  </p>
                </div>

                <div className="qb-detail-field">
                  <p className="qb-detail-field-label">Creator</p>
                  <p className="qb-detail-field-value">
                    {detail.creator?.full_name ?? 'Unknown'}
                  </p>
                </div>

                <div className="qb-detail-field">
                  <p className="qb-detail-field-label">Used in Exams</p>
                  <p className="qb-detail-field-value">{detail.usage_count ?? 0}</p>
                </div>
              </section>

              <section className="qb-detail-taxonomy-grid">
                <div className="qb-detail-taxonomy-card">
                  <p className="qb-detail-field-label">Chapters</p>
                  <p className="qb-detail-field-value">
                    {joinNames(detail.chapters.map((chapter) => chapter.chapter_name))}
                  </p>
                </div>

                <div className="qb-detail-taxonomy-card">
                  <p className="qb-detail-field-label">Learning Objectives</p>
                  <p className="qb-detail-field-value">
                    {joinNames(detail.learning_objectives.map((lo) => lo.lo_name))}
                  </p>
                </div>
              </section>

              {detail.question_type !== 'essay' && detail.options.length > 0 && (
                <section className="qb-detail-answers-card">
                  <p className="qb-detail-section-title">Answers</p>

                  <div className="qb-detail-answer-list">
                    {detail.options.map((option, index) => {
                      const correct = option.is_correct;

                      return (
                        <div
                          key={option.options_id ?? index}
                          className={`qb-detail-answer${correct ? ' is-correct' : ''}`}
                        >
                          <span className="qb-detail-answer-letter">
                            {optionLetters[index] ?? index + 1}
                          </span>
                          <span className="qb-detail-answer-text">
                            {option.options_text}
                          </span>
                          {correct && (
                            <span className="qb-detail-correct-badge">Correct</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {detail.question_type !== 'essay' && detail.options.length === 0 && (
                <section className="qb-detail-answers-card">
                  <p className="qb-detail-section-title">Answers</p>
                  <p className="qb-detail-empty-answer">No answer options available.</p>
                </section>
              )}

              {detail.question_type === 'essay' && (
                <section className="qb-detail-answers-card">
                  <p className="qb-detail-section-title">Suggested Answer / Rubric</p>
                  <p className="qb-detail-empty-answer">No suggested answer provided.</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}