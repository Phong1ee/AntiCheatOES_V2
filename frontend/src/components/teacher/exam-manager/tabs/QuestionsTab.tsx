import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import './QuestionsTab.css';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Textarea } from '../../../ui/textarea';
import { Label } from '../../../ui/label';
import { Card, CardContent } from '../../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Switch } from '../../../ui/switch';
import {
  Plus,
  GripVertical,
  Trash2,
  Copy,
  Image as ImageIcon,
  Database,
  Save,
  X,
  Loader2,
  Eye,
  Users,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { QuestionPoolModal } from '../QuestionPoolModal';
import { toast } from 'sonner';
import {
  questionService,
  type PoolCandidate,
  type PoolConfig,
  type PoolPreview,
} from '../../../../services/question.service';
import { teacherQuestionBankService } from '../../../../services/teacher-question-bank.service';
import type { ChapterSummary, LearningObjectiveSummary, QuestionDifficulty } from '../../../../types/question-bank';
import { Checkbox } from '../../../ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';

interface Question {
  id: string;
  type: 'mcq' | 'true-false' | 'essay' | 'matching';
  question: string;
  maxScore: number;
  difficulty: QuestionDifficulty | null;
  options?: string[];
  correctAnswer?: number | number[] | string;  // Support multiple correct answers for MCQ
  hasMultipleCorrect?: boolean; // Flag to indicate if MCQ has multiple correct answers
  chapterId?: number;
  optionIds?: number[];
  chapterIds?: number[];
  loIds?: number[];
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  subjectId?: string | null;
  canEditContent: boolean;
  canEditPoints: boolean;
  sourceQuestionId?: number | null;
  questionBankTargetId?: number;
  questionBankTargetTab?: 'bank' | 'mine';
  chapters: ChapterSummary[];
  learningObjectives: LearningObjectiveSummary[];
}

interface QuestionsTabProps {
  examId: string | null;
  subjectId: string;
  canCreateContent: boolean;
  onViewInQuestionBank: (questionId: number, tab: 'bank' | 'mine') => void;
}

export function QuestionsTab({ examId, subjectId, canCreateContent, onViewInQuestionBank }: QuestionsTabProps) {
  // Load questions based on examId
  const initialQuestions: Question[] = [];

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(questions[0]?.id || null);
  const [showQuestionPool, setShowQuestionPool] = useState(false);
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null);
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [activePoolRuleId, setActivePoolRuleId] = useState<number | null>(null);
  const [poolCandidates, setPoolCandidates] = useState<PoolCandidate[]>([]);
  const [includedCandidateIds, setIncludedCandidateIds] = useState<Set<number>>(new Set());
  const [savedIncludedCandidateIds, setSavedIncludedCandidateIds] = useState<Set<number>>(new Set());
  const [selectedPoolQuestionId, setSelectedPoolQuestionId] = useState<number | null>(null);
  const [poolView, setPoolView] = useState<'candidate-list' | 'question-detail' | 'preview'>('candidate-list');
  const [poolPreview, setPoolPreview] = useState<PoolPreview | null>(null);
  const [poolCandidateLoading, setPoolCandidateLoading] = useState(false);
  const [poolCandidateSaving, setPoolCandidateSaving] = useState(false);
  const [poolCandidateError, setPoolCandidateError] = useState<string | null>(null);
  const poolRequestSequence = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [exitPoolOpen, setExitPoolOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [learningObjectives, setLearningObjectives] = useState<LearningObjectiveSummary[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const selectedQ = questions.find((question) => question.id === selectedQuestion);
  const updateQuestion = useCallback((id: string, updates: Partial<Question>) => {
    setQuestions((current) => current.map((question) => (
      question.id === id ? { ...question, ...updates } : question
    )));
  }, []);

  const mapQuestions = useCallback((persistedQuestions: Awaited<ReturnType<typeof questionService.getExamQuestions>>): Question[] =>
    persistedQuestions.map((question) => {
      const correctIndexes = question.options
        .map((option, index) => option.is_correct ? index : -1)
        .filter((index) => index >= 0);
      return {
        id: String(question.question_id),
        type: question.question_type === 'MCQ' ? 'mcq' : question.question_type,
        question: question.question_text,
        maxScore: Number(question.max_score ?? question.question_point),
        difficulty: question.question_difficulties,
        options: question.options.map((option) => option.options_text),
        optionIds: question.options.map((option) => option.options_id),
        correctAnswer: question.question_type === 'true-false'
          ? (question.options[correctIndexes[0]]?.options_text.toLowerCase() ?? 'true')
          : correctIndexes.length > 1 ? correctIndexes : correctIndexes[0] ?? 0,
        hasMultipleCorrect: correctIndexes.length > 1,
        chapterId: question.chapter_ids[0],
        chapterIds: question.chapter_ids,
        loIds: question.lo_ids,
        status: question.question_status,
        subjectId: question.subject_id,
        canEditContent: question.can_edit_content,
        canEditPoints: question.can_edit_points,
        sourceQuestionId: question.source_question_id,
        questionBankTargetId: question.question_bank_target_id,
        questionBankTargetTab: question.question_bank_target_tab,
        chapters: question.chapters,
        learningObjectives: question.learning_objectives,
      };
    }), []);

  const loadQuestions = useCallback(async (questionToSelect?: string) => {
    if (!examId || examId.startsWith('new-')) {
      setQuestions([]);
      setSelectedQuestion(null);
      return;
    }

    try {
      setLoadingQuestions(true);
      setLoadError(null);
      const persistedQuestions = await questionService.getExamQuestions(Number(examId));
      const mappedQuestions = mapQuestions(persistedQuestions);
      setQuestions(mappedQuestions);
      setSelectedQuestion(questionToSelect ?? mappedQuestions[0]?.id ?? null);
      setSelectedIds(new Set());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load exam questions.');
    } finally {
      setLoadingQuestions(false);
    }
  }, [examId, mapQuestions]);

  const loadPoolConfig = useCallback(async () => {
    if (!examId || examId.startsWith('new-')) {
      setPoolConfig(null);
      setIsPoolMode(false);
      return;
    }
    const response = await questionService.getPoolConfig(Number(examId));
    if ('config' in response && response.config === null) {
      setPoolConfig(null);
      setIsPoolMode(false);
      return;
    }
    setPoolConfig(response as PoolConfig);
    setIsPoolMode((response as PoolConfig).mode === 'pool');
  }, [examId]);

  // Update questions when examId changes
  useEffect(() => {
    void Promise.all([loadQuestions(), loadPoolConfig()]).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to load persisted exam configuration.');
    });
  }, [loadQuestions, loadPoolConfig]);

  useEffect(() => {
    let active = true;
    const loadTaxonomy = async () => {
      const taxonomySubjectId = selectedQ?.subjectId ?? subjectId;
      if (!taxonomySubjectId) {
        setChapters([]);
        setLearningObjectives([]);
        setTaxonomyLoading(false);
        return;
      }
      if (selectedQ && !selectedQ.canEditContent) {
        setChapters(selectedQ.chapters);
        setLearningObjectives(selectedQ.learningObjectives);
        setTaxonomyLoading(false);
        setTaxonomyError(null);
        return;
      }
      try {
        setTaxonomyLoading(true);
        setTaxonomyError(null);
        const chapterRows = await teacherQuestionBankService.listChapters(taxonomySubjectId);
        if (!active) return;
        setChapters(chapterRows);
        const validChapterIds = new Set(chapterRows.map((chapter) => chapter.chapter_id));
        const selectedChapterIds = (selectedQ?.chapterIds ?? []).filter((chapterId) => validChapterIds.has(chapterId));
        if (selectedQ && selectedChapterIds.length !== (selectedQ.chapterIds ?? []).length) {
          updateQuestion(selectedQ.id, {
            chapterIds: selectedChapterIds,
            chapterId: selectedChapterIds[0],
          });
        }
        const loGroups = await Promise.all(
          selectedChapterIds.map((chapterId) => teacherQuestionBankService.listLearningObjectives(chapterId)),
        );
        if (!active) return;
        const unique = new Map<number, LearningObjectiveSummary>();
        loGroups.flat().forEach((lo) => unique.set(lo.lo_id, lo));
        setLearningObjectives([...unique.values()]);
        const validLoIds = new Set(unique.keys());
        if (selectedQ && (selectedQ.loIds ?? []).some((loId) => !validLoIds.has(loId))) {
          updateQuestion(selectedQ.id, {
            loIds: (selectedQ.loIds ?? []).filter((loId) => validLoIds.has(loId)),
          });
        }
      } catch (error) {
        if (active) setTaxonomyError(error instanceof Error ? error.message : 'Unable to load taxonomy.');
      } finally {
        if (active) setTaxonomyLoading(false);
      }
    };
    void loadTaxonomy();
    return () => { active = false; };
  }, [subjectId, selectedQuestion, selectedQ?.subjectId, selectedQ?.canEditContent, selectedQ?.chapterIds?.join(',')]);

  const addQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      type,
      question: '',
      maxScore: 1,
      difficulty: 'medium',
      options: type === 'mcq' ? ['', ''] : undefined,
      chapterId: undefined,
      chapterIds: [],
      loIds: [],
      status: 'draft',
      correctAnswer: type === 'true-false' ? 'true' : 0,
      subjectId,
      canEditContent: canCreateContent,
      canEditPoints: true,
      chapters: [],
      learningObjectives: [],
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestion(newQuestion.id);
  };

  const deleteQuestion = (id: string) => setQuestionToDelete(questions.find((question) => question.id === id) ?? null);

  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    try {
      setIsDeleting(true);
      if (!questionToDelete.id.startsWith('new-') && examId) {
        await questionService.removeFromExam(Number(examId), Number(questionToDelete.id));
      }
      const remaining = questions.filter((question) => question.id !== questionToDelete.id);
      setQuestions(remaining);
      if (selectedQuestion === questionToDelete.id) setSelectedQuestion(remaining[0]?.id ?? null);
      setQuestionToDelete(null);
      toast.success('Question removed from the exam.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove the question.');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadPoolRuleCandidates = useCallback(async (ruleId: number) => {
    if (!examId) return;
    const sequence = ++poolRequestSequence.current;
    try {
      setPoolCandidateLoading(true);
      setPoolCandidateError(null);
      const response = await questionService.getPoolRuleQuestions(Number(examId), ruleId);
      if (sequence !== poolRequestSequence.current) return;
      const included = new Set(
        response.questions.filter((question) => question.included).map((question) => question.question_id),
      );
      setPoolCandidates(response.questions);
      setIncludedCandidateIds(included);
      setSavedIncludedCandidateIds(new Set(included));
      setActivePoolRuleId(ruleId);
      setSelectedPoolQuestionId(null);
      setPoolView('candidate-list');
    } catch (error) {
      if (sequence === poolRequestSequence.current) {
        setPoolCandidateError(error instanceof Error ? error.message : 'Unable to load pool candidates.');
      }
    } finally {
      if (sequence === poolRequestSequence.current) setPoolCandidateLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (!isPoolMode || !poolConfig?.rules.length) {
      setActivePoolRuleId(null);
      setPoolCandidates([]);
      return;
    }
    const validRule = poolConfig.rules.some((rule) => rule.rule_id === activePoolRuleId)
      ? activePoolRuleId
      : poolConfig.rules[0].rule_id;
    if (validRule !== null) void loadPoolRuleCandidates(validRule);
  }, [examId, isPoolMode, poolConfig?.version]);

  const poolSelectionDirty = useMemo(
    () => includedCandidateIds.size !== savedIncludedCandidateIds.size
      || [...includedCandidateIds].some((id) => !savedIncludedCandidateIds.has(id)),
    [includedCandidateIds, savedIncludedCandidateIds],
  );

  const savePoolCandidates = async () => {
    if (!examId || activePoolRuleId === null) return;
    const excludedNow = [...savedIncludedCandidateIds].filter((id) => !includedCandidateIds.has(id)).length;
    if (
      excludedNow >= 5
      && !window.confirm(`Exclude ${excludedNow} currently included questions from this rule?`)
    ) return;
    try {
      setPoolCandidateSaving(true);
      setPoolCandidateError(null);
      const updated = await questionService.savePoolRuleCandidates(
        Number(examId),
        activePoolRuleId,
        [...includedCandidateIds],
      );
      setPoolConfig(updated);
      await loadPoolRuleCandidates(activePoolRuleId);
      toast.success('Candidate selection saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save candidate selection.';
      setPoolCandidateError(message);
      toast.error(message);
    } finally {
      setPoolCandidateSaving(false);
    }
  };

  const loadPoolPreview = async () => {
    if (!examId) return;
    try {
      setPoolCandidateLoading(true);
      setPoolCandidateError(null);
      const preview = await questionService.previewPool(Number(examId), `preview-${Date.now()}`);
      setPoolPreview(preview);
      setPoolView('preview');
    } catch (error) {
      setPoolCandidateError(error instanceof Error ? error.message : 'Unable to create preview draw.');
    } finally {
      setPoolCandidateLoading(false);
    }
  };

  const confirmBulkRemove = async () => {
    if (!examId) return;
    const persistedIds = [...selectedIds]
      .filter((id) => !id.startsWith('new-'))
      .map(Number);
    try {
      setBulkBusy(true);
      if (persistedIds.length > 0) {
        await questionService.bulkRemove(Number(examId), persistedIds);
      }
      const remaining = questions.filter((question) => !selectedIds.has(question.id));
      const unsavedRemaining = remaining.filter((question) => question.id.startsWith('new-'));
      const reconciled = persistedIds.length > 0
        ? [
            ...mapQuestions(await questionService.getExamQuestions(Number(examId))),
            ...unsavedRemaining,
          ]
        : remaining;
      setQuestions(reconciled);
      setSelectedQuestion(reconciled[0]?.id ?? null);
      setSelectedIds(new Set());
      setBulkRemoveOpen(false);
      toast.success(`${persistedIds.length} persisted question${persistedIds.length === 1 ? '' : 's'} removed from the exam.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove selected questions.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmExitPool = async () => {
    if (!examId) return;
    try {
      setBulkBusy(true);
      const result = await questionService.exitPoolMode(Number(examId));
      setExitPoolOpen(false);
      setPoolConfig(null);
      setIsPoolMode(false);
      setActivePoolRuleId(null);
      await loadQuestions();
      toast.success(`${result.materialized_count} unique pool candidates converted to fixed questions.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to exit pool mode.');
    } finally {
      setBulkBusy(false);
    }
  };

  const duplicateQuestion = (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (question) {
      const newQuestion = { ...question, id: `new-${Date.now()}`, optionIds: undefined };
      setQuestions([...questions, newQuestion]);
    }
  };

  const addOption = () => {
    if (!selectedQ) return;
    updateQuestion(selectedQ.id, { options: [...(selectedQ.options ?? []), ''] });
  };

  const removeOption = (index: number) => {
    if (!selectedQ?.options || selectedQ.options.length <= 2) return;
    const options = selectedQ.options.filter((_, optionIndex) => optionIndex !== index);
    const optionIds = selectedQ.optionIds?.filter((_, optionIndex) => optionIndex !== index);
    const current = Array.isArray(selectedQ.correctAnswer)
      ? selectedQ.correctAnswer
      : typeof selectedQ.correctAnswer === 'number' ? [selectedQ.correctAnswer] : [];
    const adjusted = current.filter((answer) => answer !== index).map((answer) => answer > index ? answer - 1 : answer);
    updateQuestion(selectedQ.id, {
      options,
      optionIds,
      correctAnswer: adjusted.length > 1 ? adjusted : adjusted[0] ?? 0,
    });
  };

  const saveQuestion = async () => {
    if (!selectedQ || !examId || examId.startsWith('new-')) {
      setSaveError('Save the exam before adding questions.');
      return;
    }
    if (!Number.isFinite(selectedQ.maxScore) || selectedQ.maxScore <= 0) {
      setSaveError('Max Score must be a positive number.');
      return;
    }
    if (!selectedQ.canEditPoints) {
      setSaveError('You cannot change this question for the selected exam.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      if (!selectedQ.canEditContent && !selectedQ.id.startsWith('new-')) {
        const result = await questionService.updateInExam(
          Number(examId),
          Number(selectedQ.id),
          { max_score: selectedQ.maxScore },
        );
        await loadQuestions(String(result.question_id));
        toast.success('Question score saved successfully.');
        return;
      }
      if (!selectedQ.question.trim() || !(selectedQ.subjectId ?? subjectId) || !selectedQ.difficulty) {
        throw new Error('Question text, subject, and difficulty are required.');
      }
      const isTrueFalse = selectedQ.type === 'true-false';
      if (selectedQ.type === 'matching') throw new Error('Matching questions are not supported by the API.');
      const questionType = selectedQ.type === 'mcq' ? 'MCQ' : selectedQ.type;
      const optionTexts = isTrueFalse ? ['True', 'False'] : selectedQ.options ?? [];
      const correctIndices: number[] = isTrueFalse
        ? [selectedQ.correctAnswer === 'false' ? 1 : 0]
        : Array.isArray(selectedQ.correctAnswer) ? selectedQ.correctAnswer : [Number(selectedQ.correctAnswer ?? 0)];

      if (questionType === 'MCQ' && (optionTexts.length < 2 || optionTexts.some((option) => !option.trim()))) {
        throw new Error('Multiple-choice questions require at least two non-empty options.');
      }

      const options = optionTexts.map((options_text, index) => ({
        options_id: selectedQ.optionIds?.[index],
        options_text,
        is_correct: correctIndices.includes(index),
      }));

      if (selectedQ.id.startsWith('new-')) {
        const questionId = await questionService.create({
          question_text: selectedQ.question.trim(),
          question_difficulties: selectedQ.difficulty,
          question_type: questionType,
          subject_id: selectedQ.subjectId ?? subjectId,
          chapter_ids: selectedQ.chapterIds ?? [],
          lo_ids: selectedQ.loIds ?? [],
          question_status: selectedQ.status ?? 'draft',
          options,
          exam_id: Number(examId),
          max_score: selectedQ.maxScore,
        });
        await loadQuestions(String(questionId));
      } else {
        const payload = {
          question_text: selectedQ.question.trim(),
          question_difficulties: selectedQ.difficulty,
          question_type: questionType,
          subject_id: selectedQ.subjectId ?? subjectId,
          chapter_ids: selectedQ.chapterIds ?? [],
          lo_ids: selectedQ.loIds ?? [],
          question_status: selectedQ.status ?? 'draft',
          max_score: selectedQ.maxScore,
          options,
        };
        if (isPoolMode && activePoolRuleId !== null) {
          const result = await questionService.updatePoolCandidate(
            Number(examId),
            activePoolRuleId,
            Number(selectedQ.id),
            payload,
          );
          await loadPoolRuleCandidates(activePoolRuleId);
          await loadPoolConfig();
        } else {
          const result = await questionService.updateInExam(
            Number(examId),
            Number(selectedQ.id),
            payload,
          );
          await loadQuestions(String(result.question_id));
        }
      }
      toast.success('Question saved successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the question.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPoolConfig = async (config: PoolConfig) => {
    setPoolConfig(config);
    setIsPoolMode(config.mode === 'pool');
    setActivePoolRuleId(null);
    if (config.mode === 'fixed_randomization') {
      await loadQuestions();
    } else {
      setQuestions([]);
      setSelectedQuestion(null);
    }
  };

  const activePoolRule = poolConfig?.rules.find((rule) => rule.rule_id === activePoolRuleId) ?? null;
  const selectedPoolCandidate = poolCandidates.find(
    (question) => question.question_id === selectedPoolQuestionId,
  ) ?? null;

  if (isPoolMode && poolConfig) {
    return (
      <div className="grid h-full grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r bg-gray-50">
          <div className="space-y-3 border-b p-4">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Pool Mode Active</p>
                  <p className="mt-1 text-xs text-purple-700">{poolConfig.total_questions} questions per student</p>
                  <p className="mt-1 text-xs text-purple-600">Students may receive different, overlapping question sets.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => void loadPoolPreview()}>
                <Eye className="mr-1 size-3" />Preview Draw
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (poolSelectionDirty && !window.confirm('Discard unsaved candidate changes and edit the pool configuration?')) return;
                  setShowQuestionPool(true);
                }}
              >
                <Database className="mr-1 size-3" />Edit Pool
              </Button>
              <Button size="sm" variant="outline" className="col-span-2 text-red-600" onClick={() => setExitPoolOpen(true)}>
                <X className="mr-1 size-3" />Exit Pool Mode
              </Button>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Subject</p>
              <p className="text-sm font-medium text-gray-800">{poolConfig.subject_name} ({poolConfig.subject_id})</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {poolConfig.rules.map((rule) => (
              <button
                type="button"
                key={rule.rule_id}
                onClick={() => {
                  if (poolSelectionDirty && !window.confirm('Discard unsaved candidate changes?')) return;
                  void loadPoolRuleCandidates(rule.rule_id);
                }}
                className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition ${
                  activePoolRuleId === rule.rule_id ? 'border-purple-500 ring-2 ring-purple-100' : 'hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{rule.chapter_name}</p>
                    <p className="truncate text-xs text-gray-500">{rule.lo_name ?? 'All Learning Objectives'}</p>
                  </div>
                  <Badge variant="outline">{rule.difficulty}</Badge>
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-600">
                  <span>Draw {rule.draw_count} questions</span>
                  <span>from {rule.included_count}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-white">
          {!activePoolRule ? (
            <div className="flex flex-1 items-center justify-center text-gray-500">Select a pool rule to manage its candidates.</div>
          ) : (
            <>
              <div className="border-b p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{activePoolRule.chapter_name}</h3>
                    <p className="text-sm text-gray-500">
                      {activePoolRule.lo_name ?? 'All Learning Objectives'} · {activePoolRule.difficulty} · Draw {activePoolRule.draw_count} from {includedCandidateIds.size}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{poolCandidates.length} eligible</Badge>
                    <Badge className="bg-green-100 text-green-700">{includedCandidateIds.size} included</Badge>
                    <Badge className="bg-gray-100 text-gray-700">{poolCandidates.length - includedCandidateIds.size} excluded</Badge>
                    {poolSelectionDirty && <Badge className="bg-amber-100 text-amber-700">Unsaved changes</Badge>}
                  </div>
                </div>
              </div>

              {poolCandidateError && (
                <div className="m-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <span>{poolCandidateError}</span>
                  <Button size="sm" variant="outline" onClick={() => void loadPoolRuleCandidates(activePoolRule.rule_id)}>
                    <RefreshCw className="mr-1 size-3" />Retry
                  </Button>
                </div>
              )}

              {poolView === 'preview' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Button variant="ghost" size="sm" onClick={() => setPoolView('candidate-list')}><ArrowLeft className="mr-2 size-4" />Back to Candidates</Button>
                  <h3 className="mt-4 text-lg font-medium">Preview Draw</h3>
                  <p className="text-sm text-gray-500">Seed: {poolPreview?.seed}. No attempt or candidate association was created.</p>
                  <div className="mt-4 space-y-4">
                    {poolPreview?.groups.map((group) => (
                      <Card key={group.rule_id}><CardContent className="p-4">
                        <p className="font-medium">{group.chapter_name} · {group.lo_name ?? 'All Learning Objectives'} · {group.difficulty}</p>
                        <div className="mt-3 space-y-2">
                          {group.questions.map((question) => (
                            <div key={question.question_id} className="rounded border p-3 text-sm">
                              <Badge variant="outline" className="mr-2">{question.question_type}</Badge>{question.question_text}
                            </div>
                          ))}
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>
                </div>
              ) : poolView === 'question-detail' && selectedPoolCandidate ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <Button variant="ghost" size="sm" onClick={() => setPoolView('candidate-list')}><ArrowLeft className="mr-2 size-4" />Back to Candidates</Button>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{selectedPoolCandidate.question_type}</Badge>
                      <Badge variant="outline">{selectedPoolCandidate.question_difficulties}</Badge>
                      <Badge variant="outline">{selectedPoolCandidate.question_status}</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onViewInQuestionBank(
                        selectedPoolCandidate.question_id,
                        selectedPoolCandidate.question_status === 'approved' ? 'bank' : 'mine',
                      )}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      View in Question Bank
                    </Button>
                    <p className="text-lg text-gray-900">{selectedPoolCandidate.question_text}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedPoolCandidate.chapters.map((chapter) => <Badge key={chapter.chapter_id} variant="secondary">{chapter.chapter_name}</Badge>)}
                      {selectedPoolCandidate.learning_objectives.map((lo) => <Badge key={lo.lo_id} variant="outline">{lo.lo_name}</Badge>)}
                    </div>
                    {selectedPoolCandidate.creator && <p className="text-sm text-gray-500">Created by {selectedPoolCandidate.creator.full_name}</p>}
                    {selectedPoolCandidate.options.length > 0 && (
                      <div className="space-y-2">
                        {selectedPoolCandidate.options.map((option) => (
                          <div key={option.options_id} className={`rounded-lg border p-3 ${option.is_correct ? 'border-green-400 bg-green-50' : ''}`}>
                            {option.is_correct && <CheckCircle2 className="mr-2 inline size-4 text-green-600" />}
                            {option.options_text}{option.is_correct && <span className="ml-2 text-xs font-medium text-green-700">Correct answer</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : poolCandidateLoading ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" />Loading candidates...</div>
              ) : poolCandidates.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-gray-500">No eligible questions match this rule.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => setIncludedCandidateIds(new Set(poolCandidates.map((question) => question.question_id)))}>Select All Eligible</Button>
                    <Button size="sm" variant="outline" onClick={() => setIncludedCandidateIds(new Set())}>Clear Selection</Button>
                    <Button size="sm" variant="ghost" disabled={!poolSelectionDirty} onClick={() => setIncludedCandidateIds(new Set(savedIncludedCandidateIds))}>Cancel / Revert</Button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {poolCandidates.map((question) => (
                      <Card key={question.question_id} className={includedCandidateIds.has(question.question_id) ? 'border-teal-400' : 'opacity-75'}>
                        <CardContent className="flex items-start gap-3 p-4">
                          <Checkbox
                            checked={includedCandidateIds.has(question.question_id)}
                            onCheckedChange={(checked) => setIncludedCandidateIds((current) => {
                              const next = new Set(current);
                              if (checked === true) next.add(question.question_id);
                              else next.delete(question.question_id);
                              return next;
                            })}
                            aria-label={`Include question ${question.question_id}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{question.question_type}</Badge>
                              <Badge variant="outline">{question.question_difficulties}</Badge>
                              <Badge variant="outline">{question.question_status}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm text-gray-800">{question.question_text}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {question.chapters.map((chapter) => <Badge key={chapter.chapter_id} variant="secondary">{chapter.chapter_name}</Badge>)}
                              {question.learning_objectives.map((lo) => <Badge key={lo.lo_id} variant="outline">{lo.lo_name}</Badge>)}
                            </div>
                            {question.creator && <p className="mt-2 text-xs text-gray-500">By {question.creator.full_name}</p>}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedPoolQuestionId(question.question_id); setPoolView('question-detail'); }}>View details</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t p-4">
                    <span className="text-sm text-gray-600">{includedCandidateIds.size} included · {poolCandidates.length - includedCandidateIds.size} excluded</span>
                    <Button disabled={!poolSelectionDirty || poolCandidateSaving} onClick={() => void savePoolCandidates()}>
                      {poolCandidateSaving && <Loader2 className="mr-2 size-4 animate-spin" />}Save Candidate Selection
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {showQuestionPool && examId && (
          <QuestionPoolModal
            examId={Number(examId)}
            existingQuestionIds={[]}
            subjectId={subjectId}
            initialPoolConfig={poolConfig}
            onClose={() => setShowQuestionPool(false)}
            onImported={async () => undefined}
            onPoolSaved={async (config) => {
              await handleAddPoolConfig(config);
              setShowQuestionPool(false);
            }}
          />
        )}
        <AlertDialog open={exitPoolOpen} onOpenChange={setExitPoolOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Exit pool mode?</AlertDialogTitle><AlertDialogDescription>All included pool candidates will be converted into ordinary fixed exam questions.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmExitPool(); }}>Exit Pool Mode</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
      {/* Question List - Left */}
      <div className="lg:col-span-1 flex min-h-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="question-sidebar-actions-container min-w-0 space-y-3 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-gray-700">
              {isPoolMode ? 'Pool Configuration' : loadingQuestions ? 'Loading questions...' : `Questions (${questions.length})`}
            </h3>
            {!isPoolMode && questions.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <Checkbox
                  aria-label="Select all exam questions"
                  checked={selectedIds.size === questions.length ? true : selectedIds.size > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => setSelectedIds(
                    checked === true ? new Set(questions.map((question) => question.id)) : new Set(),
                  )}
                />
                Select all
              </label>
            )}
          </div>
          {loadError && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <p>{loadError}</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-red-700" onClick={() => void loadQuestions()}>Retry</Button>
            </div>
          )}

          {isPoolMode && poolConfig && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Users className="size-4 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-purple-800">
                    <strong>Pool Mode Active</strong>
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    {poolConfig.total_questions} questions per student
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Each student receives different questions
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => poolConfig.rules[0] && void loadPoolRuleCandidates(poolConfig.rules[0].rule_id)}
                  className="flex-1 text-xs border-purple-300 hover:bg-purple-100"
                >
                  <Eye className="size-3 mr-1" />
                  View Candidates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExitPoolOpen(true)}
                  className="flex-1 text-xs border-purple-300 hover:bg-purple-100"
                >
                  <X className="size-3 mr-1" />
                  Exit
                </Button>
              </div>
            </div>
          )}

          {!isPoolMode && (
          <>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => addQuestion('mcq')}
              disabled={!canCreateContent}
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              MCQ
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addQuestion('true-false')}
              disabled={!canCreateContent}
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              T/F
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addQuestion('essay')}
              disabled={!canCreateContent}
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              Essay
            </Button>
          </div>
          <div className="question-sidebar-bulk-actions">
            <Button size="sm" variant="outline" onClick={() => setBulkRemoveOpen(true)} disabled={selectedIds.size === 0 || bulkBusy} className="min-w-0 whitespace-normal text-red-600">
              <Trash2 className="size-3 shrink-0" /> <span className="min-w-0 break-words">Remove Selected ({selectedIds.size})</span>
            </Button>
          </div>
          </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-auto min-h-9 w-full min-w-0 whitespace-normal py-2 text-center"
            onClick={() => setShowQuestionPool(true)}
            disabled={!examId || examId.startsWith('new-')}
          >
            <Database className="size-4 shrink-0" />
            <span className="min-w-0 break-words">Import from Question Bank</span>
          </Button>
        </div>

        {isPoolMode && poolConfig && activePoolRuleId === null ? (
          /* Pool Configuration Summary */
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
            <div className="space-y-2">
              <h4 className="text-xs text-gray-700 uppercase">Subject</h4>
              <Badge variant="outline" className="bg-white">
                {poolConfig.subject_id}
              </Badge>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs text-gray-700 uppercase">What each student gets</h4>
              <p className="mb-2 text-xs text-gray-500">Click a row to review which questions can be drawn for it.</p>
              {poolConfig.rules.map((rule) => (
                <Card key={rule.rule_id} className={`cursor-pointer shadow-sm ${activePoolRuleId === rule.rule_id ? 'border-purple-500' : ''}`} onClick={() => void loadPoolRuleCandidates(rule.rule_id)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-800">{rule.chapter_name}{rule.lo_name ? ` · ${rule.lo_name}` : ' · Whole chapter'}</span>
                      <Badge
                        variant="outline"
                        className={
                          rule.difficulty === 'easy'
                            ? 'text-green-600 bg-green-50'
                            : rule.difficulty === 'medium'
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-red-600 bg-red-50'
                        }
                      >
                        {rule.difficulty}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{rule.draw_count} question{rule.draw_count === 1 ? '' : 's'}</span>
                      <span className="text-gray-500">picked from {rule.available_count}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-800">Questions per student</span>
                <Badge className="bg-gradient-to-r from-teal-500 to-blue-600">
                  {poolConfig.total_questions}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {questions.map((question, index) => {
            const difficultyColors = {
              easy: 'bg-green-100 text-green-700',
              medium: 'bg-amber-100 text-amber-700',
              hard: 'bg-red-100 text-red-700',
            };

            return (
              <div
                key={question.id}
                onClick={() => setSelectedQuestion(question.id)}
                className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-white transition-colors ${
                  selectedQuestion === question.id ? 'bg-white border-l-4 border-teal-500' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!isPoolMode && (
                    <Checkbox
                      className="mt-1"
                      aria-label={`Select question ${index + 1}`}
                      checked={selectedIds.has(question.id)}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={(checked) => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(question.id);
                        else next.delete(question.id);
                        return next;
                      })}
                    />
                  )}
                  <GripVertical className="size-4 text-gray-400 mt-1 flex-shrink-0 cursor-move" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-700">Q{index + 1}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${question.difficulty ? difficultyColors[question.difficulty] : 'bg-gray-100 text-gray-600'}`}
                      >
                        {question.difficulty ?? 'Not set'}
                      </Badge>
                      {question.hasMultipleCorrect && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                          Multi
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500 ml-auto">Max {question.maxScore}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {question.question || 'Untitled question'}
                    </p>
                    <p className="text-xs text-teal-600 mt-1 uppercase">{question.type}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(question.chapterIds ?? []).slice(0, 2).map((chapterId) => (
                        <Badge key={chapterId} variant="outline" className="text-[10px]">
                          {chapters.find((chapter) => chapter.chapter_id === chapterId)?.chapter_name ?? `Chapter ${chapterId}`}
                        </Badge>
                      ))}
                      {(question.loIds ?? []).slice(0, 2).map((loId) => (
                        <Badge key={loId} variant="outline" className="text-[10px] text-purple-700">
                          {learningObjectives.find((lo) => lo.lo_id === loId)?.lo_name ?? `LO ${loId}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {!isPoolMode && <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateQuestion(question.id);
                      }}
                      disabled={!question.canEditContent}
                      className="p-1 hover:bg-gray-200 rounded disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Duplicate question"
                    >
                      <Copy className="size-3 text-gray-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteQuestion(question.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="size-3 text-red-500" />
                    </button>
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Question Editor - Right */}
      <div className="lg:col-span-2 min-h-0 overflow-y-auto p-6">
        {!selectedQ ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p>No question selected</p>
              <p className="text-sm mt-2">Select a question or create a new one</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-gray-800">Edit Question</h3>
              <div className="flex gap-2">
                {!selectedQ.id.startsWith('new-') && selectedQ.questionBankTargetId && selectedQ.questionBankTargetTab && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const targetId = selectedQ.questionBankTargetId;
                      const targetTab = selectedQ.questionBankTargetTab;
                      if (targetId && targetTab) onViewInQuestionBank(targetId, targetTab);
                    }}
                  >
                    <ExternalLink className="mr-2 size-4" />
                    View in Question Bank
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  <X className="size-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveQuestion} disabled={isSaving} className="bg-gradient-to-r from-teal-500 to-blue-600">
                  <Save className="size-4 mr-2" />
                  {isSaving ? 'Saving...' : selectedQ.canEditContent ? 'Save Question' : 'Save Points'}
                </Button>
              </div>
            </div>

            {!selectedQ.canEditContent && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                You are not assigned to this question&apos;s subject. Only the score for this exam can be changed.
              </div>
            )}

            <Card className="shadow-md rounded-2xl border-0">
              <CardContent className="p-6 space-y-4">
                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Textarea
                    value={selectedQ.question}
                    disabled={!selectedQ.canEditContent}
                    onChange={(e) =>
                      updateQuestion(selectedQ.id, { question: e.target.value })
                    }
                    placeholder="Enter your question here..."
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!selectedQ.canEditContent}>
                      <ImageIcon className="size-4 mr-2" />
                      Add Image
                    </Button>
                  </div>
                </div>

                {/* Question Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select
                      value={selectedQ.type}
                      disabled={!selectedQ.canEditContent}
                      onValueChange={(value: Question['type']) => updateQuestion(selectedQ.id, {
                        type: value,
                        options: value === 'mcq' ? (selectedQ.options?.length ? selectedQ.options : ['', '']) : undefined,
                        optionIds: value === 'mcq' ? selectedQ.optionIds : undefined,
                        correctAnswer: value === 'true-false' ? 'true' : value === 'mcq' ? 0 : undefined,
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">Multiple Choice</SelectItem>
                        <SelectItem value="true-false">True/False</SelectItem>
                        <SelectItem value="essay">Essay</SelectItem>
                        <SelectItem value="matching">Matching</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select
                      value={selectedQ.difficulty ?? undefined}
                      disabled={!selectedQ.canEditContent}
                      onValueChange={(value: QuestionDifficulty) => updateQuestion(selectedQ.id, { difficulty: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Score</Label>
                    <Input
                      type="number"
                      value={selectedQ.maxScore}
                      onChange={(e) =>
                        updateQuestion(selectedQ.id, { maxScore: Number(e.target.value) })
                      }
                      min="1"
                      step="0.01"
                      disabled={!selectedQ.canEditPoints}
                  />
                </div>
                <div className="col-span-2 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Chapters (optional)</Label>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-3">
                      {taxonomyLoading ? <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="size-3 animate-spin" /> Loading chapters...</p>
                        : chapters.length === 0 ? <p className="text-xs text-gray-500">No chapters are available for this subject.</p>
                        : chapters.map((chapter) => (
                          <label key={chapter.chapter_id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              aria-label={`Select chapter ${chapter.chapter_name}`}
                              checked={(selectedQ.chapterIds ?? []).includes(chapter.chapter_id)}
                              disabled={!selectedQ.canEditContent}
                              onCheckedChange={(checked) => {
                                const current = selectedQ.chapterIds ?? [];
                                const next = checked === true
                                  ? [...new Set([...current, chapter.chapter_id])]
                                  : current.filter((id) => id !== chapter.chapter_id);
                                updateQuestion(selectedQ.id, { chapterIds: next, chapterId: next[0] });
                              }}
                            />
                            {chapter.chapter_name}
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Learning Objectives (optional)</Label>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-3">
                      {(selectedQ.chapterIds ?? []).length === 0 ? <p className="text-xs text-gray-500">Select one or more chapters to load valid learning objectives.</p>
                        : taxonomyLoading ? <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="size-3 animate-spin" /> Loading learning objectives...</p>
                        : learningObjectives.length === 0 ? <p className="text-xs text-gray-500">No learning objectives are available for the selected chapters.</p>
                        : learningObjectives.map((lo) => (
                          <label key={lo.lo_id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              aria-label={`Select learning objective ${lo.lo_name}`}
                              checked={(selectedQ.loIds ?? []).includes(lo.lo_id)}
                              disabled={!selectedQ.canEditContent}
                              onCheckedChange={(checked) => {
                                const current = selectedQ.loIds ?? [];
                                updateQuestion(selectedQ.id, {
                                  loIds: checked === true
                                    ? [...new Set([...current, lo.lo_id])]
                                    : current.filter((id) => id !== lo.lo_id),
                                });
                              }}
                            />
                            {lo.lo_name}
                          </label>
                        ))}
                    </div>
                    {taxonomyError && <p className="text-xs text-red-600">{taxonomyError}</p>}
                  </div>
                </div>
                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                </div>

                {/* MCQ Options with Multiple Correct Answers */}
                {selectedQ.type === 'mcq' && selectedQ.options && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Answer Options</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="allow-multiple"
                          checked={selectedQ.hasMultipleCorrect || false}
                          disabled={!selectedQ.canEditContent}
                          onCheckedChange={(checked) => {
                            updateQuestion(selectedQ.id, { hasMultipleCorrect: checked });
                            // Reset to single answer if switching to single mode
                            if (!checked && Array.isArray(selectedQ.correctAnswer) && selectedQ.correctAnswer.length > 1) {
                              updateQuestion(selectedQ.id, { correctAnswer: selectedQ.correctAnswer[0] });
                            }
                          }}
                        />
                        <Label htmlFor="allow-multiple" className="text-xs text-gray-600 cursor-pointer">
                          Allow Multiple Correct
                        </Label>
                      </div>
                    </div>
                    {selectedQ.options.map((option, index) => {
                      const correctAnswers = Array.isArray(selectedQ.correctAnswer)
                        ? selectedQ.correctAnswer
                        : typeof selectedQ.correctAnswer === 'number'
                        ? [selectedQ.correctAnswer]
                        : [];
                      const isChecked = correctAnswers.includes(index);

                      return (
                        <div key={index} className="flex items-center gap-2">
                          {selectedQ.hasMultipleCorrect ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!selectedQ.canEditContent}
                              onChange={() => {
                                let newCorrectAnswers: number[];
                                if (isChecked) {
                                  newCorrectAnswers = correctAnswers.filter((i) => i !== index);
                                } else {
                                  newCorrectAnswers = [...correctAnswers, index];
                                }
                                updateQuestion(selectedQ.id, {
                                  correctAnswer: newCorrectAnswers.length === 1 ? newCorrectAnswers[0] : newCorrectAnswers,
                                });
                              }}
                              className="size-4 text-teal-600 rounded"
                            />
                          ) : (
                            <input
                              type="radio"
                              name={`correct-${selectedQ.id}`}
                              checked={isChecked}
                              disabled={!selectedQ.canEditContent}
                              onChange={() => {
                                updateQuestion(selectedQ.id, { correctAnswer: index });
                              }}
                              className="size-4 text-teal-600 cursor-pointer"
                            />
                          )}
                          <Input
                            value={option}
                            disabled={!selectedQ.canEditContent}
                            onChange={(e) => {
                              const newOptions = [...selectedQ.options!];
                              newOptions[index] = e.target.value;
                              updateQuestion(selectedQ.id, { options: newOptions });
                            }}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!selectedQ.canEditContent || selectedQ.options!.length <= 2}
                            onClick={() => removeOption(index)}
                            aria-label={`Remove option ${index + 1}`}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={!selectedQ.canEditContent}>
                      <Plus className="size-4 mr-1" /> Add option
                    </Button>
                    <p className="text-xs text-gray-500">
                      {selectedQ.hasMultipleCorrect
                        ? 'Check all correct answers'
                        : 'Select one correct answer'}
                    </p>
                  </div>
                )}

                {/* True/False */}
                {selectedQ.type === 'true-false' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tf-answer"
                          checked={selectedQ.correctAnswer === 'true'}
                          disabled={!selectedQ.canEditContent}
                          onChange={() => updateQuestion(selectedQ.id, { correctAnswer: 'true' })}
                          className="size-4 text-teal-600"
                        />
                        <span className="text-sm text-gray-700">True</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tf-answer"
                          checked={selectedQ.correctAnswer === 'false'}
                          disabled={!selectedQ.canEditContent}
                          onChange={() => updateQuestion(selectedQ.id, { correctAnswer: 'false' })}
                          className="size-4 text-teal-600"
                        />
                        <span className="text-sm text-gray-700">False</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Essay - No options needed */}
                {selectedQ.type === 'essay' && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                      Essay questions will be manually graded after students submit their answers.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Question Pool Modal */}
      {showQuestionPool && (
        <QuestionPoolModal
          examId={Number(examId)}
          existingQuestionIds={questions.filter((question) => !question.id.startsWith('new-')).map((question) => Number(question.id))}
          subjectId={subjectId}
          initialPoolConfig={poolConfig}
          onClose={() => setShowQuestionPool(false)}
          onImported={async () => {
            setIsPoolMode(false);
            setPoolConfig(null);
            await loadQuestions();
          }}
          onPoolSaved={handleAddPoolConfig}
        />
      )}
      <AlertDialog open={questionToDelete !== null} onOpenChange={(open) => { if (!open && !isDeleting) setQuestionToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this question from the exam?</AlertDialogTitle>
            <AlertDialogDescription>
              The reusable question, options, chapters, and learning outcomes will remain in the question bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDeleteQuestion(); }} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Removing...' : 'Remove question'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkRemoveOpen} onOpenChange={(open) => { if (!bulkBusy) setBulkRemoveOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove {selectedIds.size} selected question{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle><AlertDialogDescription>Only exam associations are removed. Reusable questions, options, chapters, and learning objectives remain intact.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={bulkBusy} className="bg-red-600 hover:bg-red-700" onClick={(event) => { event.preventDefault(); void confirmBulkRemove(); }}>{bulkBusy ? 'Removing...' : 'Remove Selected'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={exitPoolOpen} onOpenChange={(open) => { if (!bulkBusy) setExitPoolOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Exit Pool Mode?</AlertDialogTitle><AlertDialogDescription>Every unique saved pool candidate will become a normal fixed exam question. This can add more questions than each student previously received. Existing attempts remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={bulkBusy} onClick={(event) => { event.preventDefault(); void confirmExitPool(); }}>{bulkBusy ? 'Converting...' : 'Exit Pool Mode'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
