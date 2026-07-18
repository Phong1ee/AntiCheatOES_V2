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
import { CheckSquare, Circle, FileText, Eye, Pencil, Send, Trash2, MessageSquareWarning } from 'lucide-react';
import type { QuestionBankItem, QuestionBankTab, QuestionStatus, QuestionType } from '../../../types/question-bank';

interface QuestionListProps {
  activeTab: QuestionBankTab;
  questions: QuestionBankItem[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (questionId: number) => void;
  onEdit: (questionId: number) => void;
  onSubmit: (questionId: number) => void;
  onDelete: (questionId: number) => void;
}

const typeConfig: Record<QuestionType, { icon: typeof CheckSquare; label: string; color: string }> = {
  MCQ: { icon: CheckSquare, label: 'MCQ', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'true-false': { icon: Circle, label: 'True/False', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  essay: { icon: FileText, label: 'Essay', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const difficultyConfig = {
  easy: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  hard: 'bg-red-50 text-red-700 border-red-200',
};

const statusConfig: Record<QuestionStatus, string> = {
  draft: 'bg-gray-50 text-gray-700 border-gray-200',
  pending: 'bg-sky-50 text-sky-700 border-sky-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TaxonomyChips({ label, values }: { label: string; values: string[] }) {
  const shown = values.slice(0, 2);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-gray-500">None</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {shown.map((item) => (
            <Badge key={item} variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 max-w-full truncate">
              {item}
            </Badge>
          ))}
          {values.length > 2 && (
            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
              +{values.length - 2}
            </Badge>
          )}
        </div>
      )}
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
  onPageChange,
  onView,
  onEdit,
  onSubmit,
  onDelete,
}: QuestionListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 rounded-lg bg-white border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-lg border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing {questions.length} of {total} question{total === 1 ? '' : 's'}
        </p>
        <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
      </div>

      <div className="space-y-3">
        {questions.map((question) => {
          const typeInfo = typeConfig[question.question_type];
          const TypeIcon = typeInfo.icon;
          const date = formatDate(question.updated_at ?? question.created_at);
          const showOptionCount = question.question_type === 'MCQ' && typeof question.option_count === 'number';

          return (
            <Card key={question.question_id} className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-gray-900 line-clamp-3 flex-1">{question.question_text}</p>
                    <Button variant="outline" size="sm" onClick={() => onView(question.question_id)} className="shrink-0 gap-2">
                      <Eye className="size-4" />
                      View
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={typeInfo.color}>
                      <TypeIcon className="size-3 mr-1" />
                      {typeInfo.label}
                    </Badge>
                    {question.question_difficulties && (
                      <Badge variant="outline" className={difficultyConfig[question.question_difficulties]}>
                        {question.question_difficulties}
                      </Badge>
                    )}
                    {activeTab === 'mine' && (
                      <Badge variant="outline" className={statusConfig[question.question_status]}>
                        {question.question_status}
                      </Badge>
                    )}
                    {showOptionCount && <span className="text-xs text-gray-500">{question.option_count} options</span>}
                    {date && activeTab === 'mine' && <span className="text-xs text-gray-500">Updated {date}</span>}
                    {typeof question.usage_count === 'number' && question.usage_count > 0 && (
                      <span className="text-xs text-gray-500">Used in {question.usage_count} exams</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Subject</p>
                      {question.subject ? (
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">{question.subject.subject_id}</span> - {question.subject.subject_name}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">No Subject</p>
                      )}
                    </div>
                    <TaxonomyChips label="Chapters" values={question.chapters.map((chapter) => chapter.chapter_name)} />
                    <TaxonomyChips label="Learning Objectives" values={question.learning_objectives.map((lo) => lo.lo_name)} />
                  </div>

                  {activeTab === 'mine' && question.question_status === 'pending' && (
                    <div className="flex items-center gap-2 rounded-md bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-800">
                      <MessageSquareWarning className="size-4" />
                      Pending admin review
                    </div>
                  )}

                  {activeTab === 'mine' && (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      {question.permissions.can_edit && (
                        <Button variant="outline" size="sm" onClick={() => onEdit(question.question_id)} className="gap-2">
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      )}
                      {question.permissions.can_submit && (
                        <Button variant="outline" size="sm" onClick={() => onSubmit(question.question_id)} className="gap-2">
                          <Send className="size-4" />
                          Submit for Approval
                        </Button>
                      )}
                      {question.permissions.can_resubmit && (
                        <Button variant="outline" size="sm" onClick={() => onSubmit(question.question_id)} className="gap-2">
                          <Send className="size-4" />
                          Resubmit
                        </Button>
                      )}
                      {question.permissions.can_delete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 text-red-700 border-red-200 hover:bg-red-50">
                              <Trash2 className="size-4" />
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
                              <AlertDialogAction onClick={() => onDelete(question.question_id)} className="bg-red-600 hover:bg-red-700">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {questions.length === 0 && (
        <Card className="rounded-lg border border-gray-200 bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No questions found</p>
            <p className="text-sm text-gray-400 mt-2">Adjust the filters or create a draft in Your Questions.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
