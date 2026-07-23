import { useState } from "react";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
} from "../../ui/alert-dialog";
import type {
  QuestionBankItem,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from "../../../types/question-bank";
import "./YourQuestionsReplica.css";

type StatusFilter = QuestionStatus | "all";

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
  { icon: LucideIcon; label: string; className: string }
> = {
  MCQ: { icon: CheckSquare, label: "MCQ", className: "mcq" },
  "true-false": { icon: Circle, label: "True/False", className: "true-false" },
  essay: { icon: FileText, label: "Essay", className: "essay" },
};

const difficultyConfig: Record<
  QuestionDifficulty,
  { label: string; className: string }
> = {
  easy: { label: "Easy", className: "easy" },
  medium: { label: "Medium", className: "medium" },
  hard: { label: "Hard", className: "hard" },
};

const statusConfig: Record<
  QuestionStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  draft: { label: "Draft", icon: AlertCircle, className: "draft" },
  pending: { label: "Pending", icon: Clock, className: "pending" },
  approved: { label: "Approved", icon: CheckCircle, className: "approved" },
  rejected: { label: "Rejected", icon: XCircle, className: "rejected" },
};

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRejectedFeedback(question: QuestionBankItem): string | null {
  return (
    (question as QuestionBankItem & { rejected_feedback?: string | null })
      .rejected_feedback ?? null
  );
}

function joinValues(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
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

  return (
    <section className="yq-ref-root" aria-label="Your questions">
      <div
        className="yq-ref-status-tabs"
        role="tablist"
        aria-label="Question status"
      >
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          const count = statusCounts?.[tab.value];

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`yq-ref-status-tab${active ? " is-active" : ""}`}
              onClick={() => onStatusFilterChange(tab.value)}
            >
              <span>{tab.label}</span>
              {typeof count === "number" && (
                <span className={`yq-ref-status-count status-${tab.value}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="yq-ref-toolbar">
        <p className="yq-ref-total">
          <strong>{loading ? 0 : total}</strong> question
          {total === 1 ? "" : "s"}
        </p>

        <button
          type="button"
          className="yq-ref-new-button"
          onClick={onNewQuestion}
        >
          <Plus aria-hidden="true" />
          New Question
        </button>
      </div>

      {loading && (
        <div className="yq-ref-state-card">
          <Loader2 className="yq-ref-spinner" aria-hidden="true" />
          <p>Loading questions...</p>
        </div>
      )}

      {error && !loading && <div className="yq-ref-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="yq-ref-list">
            {questions.map((question) => {
              const type = typeConfig[question.question_type];
              const TypeIcon = type.icon;
              const status = statusConfig[question.question_status];
              const StatusIcon = status.icon;
              const difficulty = question.question_difficulties
                ? difficultyConfig[question.question_difficulties]
                : null;
              const expanded = expandedId === question.question_id;
              const rejectedFeedback = getRejectedFeedback(question);
              const createdDate = formatDate(question.created_at);
              const updatedDate = formatDate(question.updated_at);
              const displayDate = updatedDate ?? createdDate;
              const chapterText = joinValues(
                question.chapters.map((chapter) => chapter.chapter_name),
              );
              const loText = joinValues(
                question.learning_objectives.map((lo) => lo.lo_name),
              );
              const showOptionCount =
                question.question_type === "MCQ" &&
                typeof question.option_count === "number";

              return (
                <article
                  key={question.question_id}
                  className={`yq-ref-card status-${question.question_status}`}
                >
                  <div className="yq-ref-card-main">
                    <div className={`yq-ref-type-icon type-${type.className}`}>
                      <TypeIcon aria-hidden="true" />
                    </div>

                    <div className="yq-ref-card-content">
                      <p className="yq-ref-question-text">
                        {question.question_text}
                      </p>

                      <div className="yq-ref-pills">
                        <span className={`yq-ref-pill type-${type.className}`}>
                          {type.label}
                          {showOptionCount && (
                            <span className="yq-ref-pill-muted">
                              · {question.option_count} opts
                            </span>
                          )}
                        </span>

                        {difficulty && (
                          <span
                            className={`yq-ref-pill difficulty-${difficulty.className}`}
                          >
                            <span className="yq-ref-difficulty-dot" />
                            {difficulty.label}
                          </span>
                        )}

                        <span
                          className={`yq-ref-pill status-${status.className}`}
                        >
                          <StatusIcon aria-hidden="true" />
                          {status.label}
                        </span>

                        {typeof question.usage_count === "number" &&
                          question.usage_count > 0 && (
                            <span className="yq-ref-usage">
                              <BarChart2 aria-hidden="true" />
                              Used in {question.usage_count} exam
                              {question.usage_count === 1 ? "" : "s"}
                            </span>
                          )}

                        {question.subject && (
                          <span
                            className="yq-ref-subject-tag"
                            title={question.subject.subject_name}
                          >
                            #{question.subject.subject_id}
                          </span>
                        )}
                      </div>

                      {question.question_status === "rejected" &&
                        rejectedFeedback && (
                          <div className="yq-ref-rejected-reason">
                            <XCircle aria-hidden="true" />
                            <span>{rejectedFeedback}</span>
                          </div>
                        )}
                    </div>

                    <div className="yq-ref-card-actions">
                      <button
                        type="button"
                        className="yq-ref-icon-button"
                        onClick={() =>
                          setExpandedId(expanded ? null : question.question_id)
                        }
                        aria-label={
                          expanded ? "Collapse question" : "Expand question"
                        }
                        title={expanded ? "Hide details" : "Show details"}
                      >
                        {expanded ? (
                          <ChevronUp aria-hidden="true" />
                        ) : (
                          <ChevronDown aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        className="yq-ref-icon-button is-view"
                        onClick={() => onView(question.question_id)}
                        aria-label="View question"
                        title="View"
                      >
                        <Eye aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="yq-ref-expanded">
                      <div className="yq-ref-expanded-inner">
                        <div className="yq-ref-metadata-grid">
                          <div className="yq-ref-meta-item">
                            <BookOpen aria-hidden="true" />
                            <div>
                              <p className="yq-ref-meta-label">Subject</p>
                              <p className="yq-ref-meta-value">
                                {question.subject
                                  ? `${question.subject.subject_id} - ${question.subject.subject_name}`
                                  : "No Subject"}
                              </p>
                            </div>
                          </div>

                          <div className="yq-ref-meta-item">
                            <BookOpen aria-hidden="true" />
                            <div>
                              <p className="yq-ref-meta-label">Chapter</p>
                              <p className="yq-ref-meta-value">{chapterText}</p>
                              {question.learning_objectives.length > 0 && (
                                <p className="yq-ref-meta-secondary">
                                  LO: {loText}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="yq-ref-meta-item">
                            <Calendar aria-hidden="true" />
                            <div>
                              <p className="yq-ref-meta-label">
                                {updatedDate ? "Updated" : "Created"}
                              </p>
                              <p className="yq-ref-meta-value">
                                {displayDate ?? "Not available"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="yq-ref-action-row">
                          {question.permissions.can_edit && (
                            <button
                              type="button"
                              className="yq-ref-action-button is-edit"
                              onClick={() => onEdit(question.question_id)}
                            >
                              <Pencil aria-hidden="true" />
                              Edit
                            </button>
                          )}

                          {question.permissions.can_submit && (
                            <button
                              type="button"
                              className="yq-ref-action-button is-submit"
                              onClick={() => onSubmit(question.question_id)}
                            >
                              <Send aria-hidden="true" />
                              Submit for Approval
                            </button>
                          )}

                          {question.permissions.can_resubmit && (
                            <button
                              type="button"
                              className="yq-ref-action-button is-submit"
                              onClick={() => onSubmit(question.question_id)}
                            >
                              <Send aria-hidden="true" />
                              Resubmit
                            </button>
                          )}

                          {question.permissions.can_delete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="yq-ref-action-button is-delete"
                                >
                                  <Trash2 aria-hidden="true" />
                                  Delete
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete question?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the question from your list
                                    when it is not used by an exam.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      onDelete(question.question_id)
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {question.question_status === "pending" &&
                            !question.permissions.can_edit &&
                            !question.permissions.can_submit &&
                            !question.permissions.can_resubmit &&
                            !question.permissions.can_delete && (
                              <span className="yq-ref-pending-note">
                                <Clock aria-hidden="true" />
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
            <div className="yq-ref-empty">
              <div className="yq-ref-empty-icon">
                <FileText aria-hidden="true" />
              </div>
              <p className="yq-ref-empty-title">No questions here</p>
              <p className="yq-ref-empty-text">
                {statusFilter === "all"
                  ? "Start creating questions to add them to your bank."
                  : `You have no ${statusFilter} questions.`}
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="yq-ref-pagination">
              <span>
                Page {page} of {totalPages}
              </span>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
