import { useEffect, useMemo, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertCircle, Plus, Save, Send, Trash2 } from 'lucide-react';
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
    if (questionType === 'MCQ') {
      if (nonEmptyOptions.length < 2) errors.push('MCQ requires at least two options.');
      if (!nonEmptyOptions.some((option) => option.is_correct)) errors.push('MCQ requires at least one correct option.');
    }
    if (questionType === 'true-false') {
      const labels = nonEmptyOptions.map((option) => option.options_text.trim().toLowerCase()).sort().join(',');
      if (labels !== 'false,true') errors.push('True/False must contain True and False.');
      if (nonEmptyOptions.filter((option) => option.is_correct).length !== 1) errors.push('True/False requires exactly one correct answer.');
    }
    if (questionType === 'essay' && nonEmptyOptions.length > 0) errors.push('Essay questions cannot include MCQ options.');
    return errors;
  }, [difficulty, hasSubject, options, questionText, questionType]);

  const draftDisabled = !questionText.trim() || !hasSubject || isPending || saving;
  const submitDisabled = submitErrors.length > 0 || isPending || saving;

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

  const addOption = () => setOptions((current) => [...current, { options_text: '', is_correct: false }]);
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
    setChapterIds((current) => (checked ? [...current, chapterId] : current.filter((id) => id !== chapterId)));
  };

  const toggleLo = (loId: number, checked: boolean) => {
    setLoIds((current) => (checked ? [...current, loId] : current.filter((id) => id !== loId)));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="question-editor-modal flex min-h-0 max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 pr-14">
          <DialogTitle>{questionId ? 'Edit Question' : 'New Question'}</DialogTitle>
          <DialogDescription>Save a reusable draft or submit it for admin review.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {loading && <div className="h-48 rounded-lg bg-gray-100 animate-pulse" />}
          {isApprovedEdit && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="size-4 text-amber-700" />
              <AlertDescription className="text-amber-800">
                Editing this approved question will submit it for admin review again.
              </AlertDescription>
            </Alert>
          )}
          {isPending && (
            <Alert className="border-sky-200 bg-sky-50">
              <AlertCircle className="size-4 text-sky-700" />
              <AlertDescription className="text-sky-800">Pending questions are read-only for teachers.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="size-4 text-red-700" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {!loading && (
            <>
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Question Type *</Label>
                      <Select value={questionType} onValueChange={(value) => setQuestionType(value as QuestionType)} disabled={isPending}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCQ">Multiple Choice</SelectItem>
                          <SelectItem value="true-false">True/False</SelectItem>
                          <SelectItem value="essay">Essay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={difficulty} onValueChange={(value) => setDifficulty(value as QuestionDifficulty | 'none')} disabled={isPending}>
                        <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label>Question Text *</Label>
                    <Textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={4} disabled={isPending} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-base">Classification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select
                      value={subjectId}
                      onValueChange={(value) => {
                        setSubjectId(value);
                        setChapterIds([]);
                        setLoIds([]);
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger>
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
                      <p className="text-xs text-red-600">Subject is required before saving or submitting.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chapter (Optional)</Label>
                      <div className="rounded-lg border border-gray-200 p-3 space-y-2 min-h-24">
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

                    <div className="space-y-2">
                      <Label>Learning Objective (Optional)</Label>
                      <div className="rounded-lg border border-gray-200 p-3 space-y-2 min-h-24">
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
                </CardContent>
              </Card>

              <Card className="rounded-lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Answers</CardTitle>
                    {questionType === 'MCQ' && (
                      <Button variant="outline" size="sm" onClick={addOption} disabled={isPending} className="gap-2">
                        <Plus className="size-4" />
                        Add Option
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {questionType === 'MCQ' &&
                    options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Checkbox checked={option.is_correct} onCheckedChange={(checked) => updateOption(index, { is_correct: checked === true })} disabled={isPending} />
                        <Input
                          value={option.options_text}
                          onChange={(event) => updateOption(index, { options_text: event.target.value })}
                          placeholder={`Option ${index + 1}`}
                          disabled={isPending}
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeOption(index)} disabled={isPending || options.length <= 2} className="text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}

                  {questionType === 'true-false' && (
                    <div className="flex gap-3">
                      {(['true', 'false'] as const).map((answer) => {
                        const isCorrect = options.some((option) => option.options_text.toLowerCase() === answer && option.is_correct);
                        return (
                          <Button
                            key={answer}
                            variant={isCorrect ? 'default' : 'outline'}
                            onClick={() => setTrueFalseAnswer(answer)}
                            disabled={isPending}
                          >
                            {answer === 'true' ? 'True' : 'False'}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {questionType === 'essay' && <p className="text-sm text-gray-500">No suggested answer field exists in the current schema.</p>}
                </CardContent>
              </Card>

              {submitErrors.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm text-gray-700 mb-2">Submit validation</p>
                  <div className="flex flex-wrap gap-2">
                    {submitErrors.map((item) => (
                      <Badge key={item} variant="outline" className="bg-white text-gray-600">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {!isApprovedEdit && (
              <Button variant="outline" onClick={saveDraft} disabled={draftDisabled || loading} className="gap-2">
                <Save className="size-4" />
                Save Draft
              </Button>
            )}
            <Button onClick={submitForApproval} disabled={submitDisabled || loading} className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Send className="size-4" />
              {isApprovedEdit ? 'Save Changes & Submit for Approval' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
