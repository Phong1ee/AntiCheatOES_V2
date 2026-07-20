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

const typeConfig: Record<QuestionType, { icon: LucideIcon; label: string; className: string }> = {
  MCQ: { icon: CheckSquare, label: 'MCQ', className: 'mcq' },
  'true-false': { icon: Circle, label: 'True/False', className: 'true-false' },
  essay: { icon: FileText, label: 'Essay', className: 'essay' },
};

const difficultyLabels: Record<QuestionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MetaItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="qb-ref-meta">
      <Icon />
      <div>
        <p className="qb-ref-meta-label">{label}</p>
        <p className="qb-ref-meta-value">{value}</p>
      </div>
    </div>
  );
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="qb-ref-meta-value">None</span>;
  return (
    <div className="qb-ref-chip-wrap">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className="qb-ref-chip" title={value}>
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
    <div>
      <div className="qb-ref-count-row">
        <p className="qb-ref-count-text">
          <strong>{total}</strong> question{total === 1 ? '' : 's'} found
        </p>
        <p className="qb-ref-page-text">Page {page} of {totalPages}</p>
      </div>

      {loading ? (
        <div className="qb-ref-loading">
          <div className="qb-ref-loading-inner">
            <span className="qb-ref-spinner" aria-hidden="true" />
            <p className="qb-ref-loading-text">Loading questions...</p>
          </div>
        </div>
      ) : error ? (
        <div className="qb-ref-error">
          <div className="qb-ref-error-inner">{error}</div>
        </div>
      ) : questions.length === 0 ? (
        <div className="qb-ref-empty">
          <div className="qb-ref-empty-inner">
            <span className="qb-ref-empty-icon"><FileText /></span>
            <p className="qb-ref-empty-title">No questions found</p>
            <p className="qb-ref-empty-description">Try adjusting your filters or search term</p>
          </div>
        </div>
      ) : (
        <div className="qb-ref-list">
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
                className={`qb-ref-card ${difficulty ?? 'no-difficulty'}`}
              >
                <div className="qb-ref-card-main">
                  <span className={`qb-ref-type-icon ${type.className}`}>
                    <TypeIcon />
                  </span>

                  <div className="qb-ref-card-body">
                    <p className="qb-ref-question-text">{question.question_text}</p>

                    <div className="qb-ref-pills">
                      <span className={`qb-ref-type-pill ${type.className}`}>
                        {type.label}
                        {typeof question.option_count === 'number' && question.question_type !== 'essay' && (
                          <span className="muted">· {question.option_count} opts</span>
                        )}
                      </span>

                      {difficulty && (
                        <span className={`qb-ref-difficulty-pill ${difficulty}`}>
                          <span className="qb-ref-difficulty-dot" />
                          {difficultyLabels[difficulty]}
                        </span>
                      )}

                      {typeof question.usage_count === 'number' && (
                        <span className="qb-ref-usage">
                          <BarChart2 /> Used {question.usage_count}×
                        </span>
                      )}

                      {question.subject && (
                        <span className="qb-ref-tag" title={question.subject.subject_name}>
                          #{question.subject.subject_id}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="qb-ref-card-actions">
                    <button
                      type="button"
                      className="qb-ref-icon-button"
                      onClick={() => setExpandedId(expanded ? null : question.question_id)}
                      title="Show details"
                      aria-label={expanded ? 'Hide details' : 'Show details'}
                    >
                      {expanded ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    <button
                      type="button"
                      className="qb-ref-icon-button view"
                      onClick={() => onView(question.question_id)}
                      title="View question"
                      aria-label="View question"
                    >
                      <Eye />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="qb-ref-expanded">
                    <div className="qb-ref-expanded-inner">
                      <MetaItem icon={BookOpen} label="Subject" value={subject} />
                      <MetaItem
                        icon={Calendar}
                        label="Date"
                        value={formatDate(question.updated_at ?? question.created_at)}
                      />
                      <MetaItem
                        icon={BarChart2}
                        label="Usage"
                        value={`Used ${question.usage_count ?? 0} time${question.usage_count === 1 ? '' : 's'}`}
                      />

                      <div className="qb-ref-taxonomy-row">
                        <div className="qb-ref-meta">
                          <Layers3 />
                          <div>
                            <p className="qb-ref-meta-label">Chapters</p>
                            <Chips values={chapters} />
                          </div>
                        </div>
                        <div className="qb-ref-meta">
                          <Target />
                          <div>
                            <p className="qb-ref-meta-label">Learning Objectives</p>
                            <Chips values={objectives} />
                          </div>
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
        <div className="qb-ref-pagination-row">
          <button
            type="button"
            className="qb-ref-page-button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="qb-ref-page-button"
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