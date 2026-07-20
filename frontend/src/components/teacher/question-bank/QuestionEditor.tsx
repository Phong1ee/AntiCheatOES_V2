import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './QuestionEditorReplica.css';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertCircle, Loader2, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { teacherQuestionBankService } from '../../../services/teacher-question-bank.service';
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionDetail,
  QuestionDifficulty,
  QuestionOptionPayload,
  QuestionPayload,
  QuestionStatus,
  QuestionType,
  SubjectCount,
} from '../../../types/question-bank';

interface QuestionEditorProps {
  open: boolean;
  questionId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const defaultOptions: QuestionOptionPayload[] = [
  { options_text: '', is_correct: true },
  { options_text: '', is_correct: false },
];
const subjectPlaceholder = '__select_subject__';
const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function statusNeedsSubmit(status?: QuestionStatus | null) {
  return status === 'draft' || status === 'rejected';
}

export function QuestionEditor({ open, questionId, onClose, onSaved }: QuestionEditorProps) {
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [learningObjectives, setLearningObjectives] = useState<LearningObjectiveSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('MCQ');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'none'>('none');
  const [subjectId, setSubjectId] = useState<string>(subjectPlaceholder);
  const [chapterIds, setChapterIds] = useState<number[]>([]);
  const [loIds, setLoIds] = useState<number[]>([]);
  const [options, setOptions] = useState<QuestionOptionPayload[]>(defaultOptions);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isApprovedEdit = detail?.question_status === 'approved';
  const isPending = detail?.question_status === 'pending';

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadInitialData() {
      setLoading(true);
      setError(null);
      try {
        const [subjectMeta, questionDetail] = await Promise.all([
          teacherQuestionBankService.listSubjectCounts('mine'),
          questionId ? teacherQuestionBankService.getDetail(questionId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSubjects(subjectMeta.subjects);
        setDetail(questionDetail);
        setQuestionText(questionDetail?.question_text ?? '');
        setQuestionType(questionDetail?.question_type ?? 'MCQ');
        setDifficulty(questionDetail?.question_difficulties ?? 'none');
        setSubjectId(questionDetail?.subject?.subject_id ?? subjectPlaceholder);
        setChapterIds(questionDetail?.chapters.map((chapter) => chapter.chapter_id) ?? []);
        setLoIds(questionDetail?.learning_objectives.map((lo) => lo.lo_id) ?? []);
        setOptions(questionDetail?.options.length ? questionDetail.options : defaultOptions);
        setSubmitAttempted(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load question editor data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [open, questionId]);

  useEffect(() => {
    if (!open || subjectId === subjectPlaceholder) {
      setChapters([]);
      return;
    }

    let cancelled = false;
    teacherQuestionBankService
      .listChapters(subjectId)
      .then((items) => {
        if (cancelled) return;
        setChapters(items);
        setChapterIds((current) => current.filter((id) => items.some((chapter) => chapter.chapter_id === id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load chapters.'));
    return () => {
      cancelled = true;
    };
  }, [open, subjectId]);

  useEffect(() => {
    if (!open || chapterIds.length === 0) {
      setLearningObjectives([]);
      setLoIds([]);
      return;
    }

    let cancelled = false;
    Promise.all(chapterIds.map((chapterId) => teacherQuestionBankService.listLearningObjectives(chapterId)))
      .then((groups) => {
        if (cancelled) return;
        const merged = Array.from(
          new Map(groups.flat().map((item) => [item.lo_id, item])).values(),
        );
        setLearningObjectives(merged);
        setLoIds((current) => current.filter((id) => merged.some((lo) => lo.lo_id === id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load learning objectives.'));
    return () => {
      cancelled = true;
    };
  }, [open, chapterIds]);

  const hasSubject = subjectId !== subjectPlaceholder;

  const submitErrors = useMemo(() => {
    const errors: string[] = [];
    if (!questionText.trim()) errors.push('Question text is required.');
    if (!hasSubject) errors.push('Subject is required.');
    if (difficulty === 'none') errors.push('Difficulty is required when submitting.');
    const nonEmptyOptions = options.filter((option) => option.options_text.trim());
    const normalizedOptions = nonEmptyOptions.map((option) => option.options_text.trim().toLowerCase());
    const hasDuplicateOptions = new Set(normalizedOptions).size !== normalizedOptions.length;
    if (questionType === 'MCQ') {
      if (nonEmptyOptions.length < 2) errors.push('MCQ requires at least two options.');
      if (!nonEmptyOptions.some((option) => option.is_correct)) errors.push('MCQ requires at least one correct option.');
      if (hasDuplicateOptions) errors.push('Answer options must be unique.');
    }
    if (questionType === 'true-false') {
      const labels = nonEmptyOptions.map((option) => option.options_text.trim().toLowerCase()).sort().join(',');
      if (labels !== 'false,true') errors.push('True/False must contain True and False.');
      if (nonEmptyOptions.filter((option) => option.is_correct).length !== 1) errors.push('True/False requires exactly one correct answer.');
    }
    if (questionType === 'essay' && nonEmptyOptions.length > 0) errors.push('Essay questions cannot include MCQ options.');
    return errors;
  }, [difficulty, hasSubject, options, questionText, questionType]);

  const draftDisabled = !questionText.trim() || !hasSubject || isPending || saving || loading;
  const submitActionDisabled = isPending || saving || loading;

  const payload = (): QuestionPayload => ({
    question_text: questionText,
    question_type: questionType,
    question_difficulties: difficulty === 'none' ? null : difficulty,
    subject_id: hasSubject ? subjectId : '',
    chapter_ids: chapterIds,
    lo_ids: chapterIds.length > 0 ? loIds : [],
    options: questionType === 'essay' ? [] : options,
  });

  const closeAfterSave = () => {
    onSaved();
    onClose();
  };

  const saveDraft = async () => {
    if (draftDisabled || loading) return;
    setSaving(true);
    setError(null);
    try {
      if (questionId) {
        await teacherQuestionBankService.update(questionId, payload());
      } else {
        await teacherQuestionBankService.create(payload());
      }
      toast.success('Draft saved.');
      closeAfterSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    setSubmitAttempted(true);
    if (submitErrors.length > 0 || submitActionDisabled) return;
    setSaving(true);
    setError(null);
    try {
      if (questionId) {
        await teacherQuestionBankService.update(questionId, payload());
        if (statusNeedsSubmit(detail?.question_status)) await teacherQuestionBankService.submit(questionId);
      } else {
        const created = await teacherQuestionBankService.create(payload());
        await teacherQuestionBankService.submit(created.question_id);
      }
      toast.success(isApprovedEdit ? 'Changes submitted for review.' : 'Question submitted for approval.');
      closeAfterSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit question.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionTypeChange = (value: QuestionType) => {
    setQuestionType(value);
    if (value === 'true-false') {
      setOptions([
        { options_text: 'True', is_correct: false },
        { options_text: 'False', is_correct: false },
      ]);
      return;
    }
    if (value === 'essay') {
      setOptions([]);
      return;
    }
    setOptions((current) => (questionType === 'MCQ' && current.length >= 2 ? current : defaultOptions));
  };

  const addOption = () => setOptions((current) => (
    current.length >= optionLetters.length ? current : [...current, { options_text: '', is_correct: false }]
  ));
  const removeOption = (index: number) => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const updateOption = (index: number, patch: Partial<QuestionOptionPayload>) => {
    setOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const setTrueFalseAnswer = (answer: 'true' | 'false') => {
    setOptions([
      { options_text: 'True', is_correct: answer === 'true' },
      { options_text: 'False', is_correct: answer === 'false' },
    ]);
  };

  const toggleChapter = (chapterId: number, checked: boolean) => {
    setChapterIds((current) => {
      const next = checked ? [...current, chapterId] : current.filter((id) => id !== chapterId);
      if (next.length === 0) setLoIds([]);
      return next;
    });
  };

  const toggleLo = (loId: number, checked: boolean) => {
    setLoIds((current) => (checked ? [...current, loId] : current.filter((id) => id !== loId)));
  };

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="qb-editor-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="qb-editor-modal">
        <div className="qb-editor-header">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{questionId ? 'Edit Question' : 'New Question'}</h2>
            <p className="mt-0.5 text-sm text-gray-400">Save a reusable draft or submit it for admin review.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="qb-editor-close"
            aria-label="Close question editor"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="qb-editor-body">
          {loading && (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="size-8 animate-spin text-teal-600" />
                <p className="text-sm font-medium text-gray-700">Loading question editor...</p>
              </div>
            </div>
          )}

          {isApprovedEdit && (
            <Alert className="rounded-xl border-amber-200 bg-amber-50">
              <AlertCircle className="size-4 text-amber-700" />
              <AlertDescription className="text-amber-800">
                Editing this approved question will submit it for admin review again.
              </AlertDescription>
            </Alert>
          )}
          {isPending && (
            <Alert className="rounded-xl border-sky-200 bg-sky-50">
              <AlertCircle className="size-4 text-sky-700" />
              <AlertDescription className="text-sky-800">Pending questions are read-only for teachers.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert className="rounded-xl border-red-200 bg-red-50">
              <AlertCircle className="size-4 text-red-700" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {!loading && (
            <>
              <section className="space-y-4 rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800">Basic Information</h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Question Type *</Label>
                    <Select value={questionType} onValueChange={(value) => handleQuestionTypeChange(value as QuestionType)} disabled={isPending}>
                      <SelectTrigger className="rounded-lg border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-teal-300 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MCQ">Multiple Choice</SelectItem>
                        <SelectItem value="true-false">True/False</SelectItem>
                        <SelectItem value="essay">Essay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Difficulty</Label>
                    <Select value={difficulty} onValueChange={(value) => setDifficulty(value as QuestionDifficulty | 'none')} disabled={isPending}>
                      <SelectTrigger className="rounded-lg border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-teal-300 focus:ring-offset-0">
                        <SelectValue placeholder="Optional for drafts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No difficulty</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Question Text *</Label>
                  <Textarea
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    rows={4}
                    disabled={isPending}
                    placeholder="Enter your question here..."
                    className={`resize-none rounded-lg bg-gray-50 text-sm placeholder:text-gray-400 focus-visible:border-teal-300 focus-visible:ring-teal-300 ${
                      !questionText.trim() ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {!questionText.trim() && <p className="text-xs text-red-500">Question text is required.</p>}
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800">Classification</h3>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Subject *</Label>
                  <Select
                    value={subjectId}
                    onValueChange={(value) => {
                      setSubjectId(value);
                      setChapterIds([]);
                      setLoIds([]);
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger
                      className={`rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-teal-300 focus:ring-offset-0 ${
                        !hasSubject ? 'border-red-300' : 'border-gray-200'
                      }`}
                    >
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={subjectPlaceholder} disabled>
                        Select subject
                      </SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.subject_id} value={subject.subject_id}>
                          {subject.subject_id} - {subject.subject_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!hasSubject && (
                    <p className="text-xs text-red-500">Subject is required before saving or submitting.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Chapter <span className="font-normal text-gray-400">(Optional)</span>
                    </Label>
                    <div className="min-h-24 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {!hasSubject && <p className="text-sm text-gray-500">Select a subject to load chapters.</p>}
                      {hasSubject && chapters.length === 0 && <p className="text-sm text-gray-500">No chapters are available for this subject.</p>}
                      {chapters.map((chapter) => (
                        <label key={chapter.chapter_id} className="flex items-center gap-2 text-sm text-gray-700">
                          <Checkbox
                            checked={chapterIds.includes(chapter.chapter_id)}
                            onCheckedChange={(checked) => toggleChapter(chapter.chapter_id, checked === true)}
                            disabled={isPending}
                          />
                          {chapter.chapter_name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Learning Objective <span className="font-normal text-gray-400">(Optional)</span>
                    </Label>
                    <div className="min-h-24 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {chapterIds.length === 0 && <p className="text-sm text-gray-500">Select at least one chapter to load learning objectives.</p>}
                      {chapterIds.length > 0 && learningObjectives.length === 0 && (
                        <p className="text-sm text-gray-500">No learning objectives are available for selected chapters.</p>
                      )}
                      {learningObjectives.map((lo) => (
                        <label key={lo.lo_id} className="flex items-center gap-2 text-sm text-gray-700">
                          <Checkbox
                            checked={loIds.includes(lo.lo_id)}
                            onCheckedChange={(checked) => toggleLo(lo.lo_id, checked === true)}
                            disabled={isPending || chapterIds.length === 0}
                          />
                          {lo.lo_name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-800">Answers</h3>
                  {questionType === 'MCQ' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      disabled={isPending || options.length >= optionLetters.length}
                      className="gap-1.5 rounded-lg border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Plus className="size-3.5" />
                      Add Option
                    </Button>
                  )}
                </div>

                {questionType === 'MCQ' &&
                  options.map((option, index) => (
                    <div
                      key={option.options_id ?? index}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                        option.is_correct ? 'border-teal-300 bg-teal-50' : 'border-transparent bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => updateOption(index, { is_correct: !option.is_correct })}
                        disabled={isPending}
                        className={`flex size-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          option.is_correct ? 'border-teal-500 bg-teal-500 text-white' : 'border-gray-300 bg-white hover:border-teal-400'
                        }`}
                        title="Mark as correct"
                      >
                        {option.is_correct && (
                          <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className={`w-5 flex-shrink-0 text-center text-xs font-semibold ${option.is_correct ? 'text-teal-600' : 'text-gray-400'}`}>
                        {optionLetters[index] ?? index + 1}
                      </span>
                      <Input
                        value={option.options_text}
                        onChange={(event) => updateOption(index, { options_text: event.target.value })}
                        placeholder={`Option ${index + 1}`}
                        disabled={isPending}
                        className={`rounded-lg bg-gray-50 text-sm placeholder:text-gray-400 focus-visible:border-teal-300 focus-visible:ring-teal-300 ${
                          option.is_correct ? 'border-teal-200 text-teal-800' : 'border-gray-200'
                        }`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                        disabled={isPending || options.length <= 2}
                        className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}

                {questionType === 'true-false' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(['true', 'false'] as const).map((answer) => {
                      const isCorrect = options.some((option) => option.options_text.toLowerCase() === answer && option.is_correct);
                      return (
                        <button
                          key={answer}
                          type="button"
                          onClick={() => setTrueFalseAnswer(answer)}
                          disabled={isPending}
                          className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isCorrect
                              ? 'border-teal-300 bg-teal-50 text-teal-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-200 hover:bg-teal-50/50'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            {answer === 'true' ? 'True' : 'False'}
                            {isCorrect && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-600">Correct</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {questionType === 'essay' && <p className="text-sm text-gray-500">No suggested answer field exists in the current schema.</p>}
              </section>

              {submitAttempted && submitErrors.length > 0 && (
                <section className="space-y-2 rounded-xl border border-red-100 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="size-4" />
                    <p className="text-xs font-semibold">Submit validation</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submitErrors.map((item) => (
                      <Badge key={item} variant="outline" className="border-red-200 bg-white text-red-600">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="qb-editor-footer">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-lg border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <div className="qb-editor-actions">
            {!isApprovedEdit && (
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={draftDisabled || loading}
                className="gap-1.5 rounded-lg border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Draft
              </Button>
            )}
            <Button
              onClick={submitForApproval}
              disabled={submitActionDisabled}
              className="gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isApprovedEdit ? 'Save Changes & Submit for Approval' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}