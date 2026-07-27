import { useCallback, useState, useEffect } from 'react';
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
  Shuffle,
} from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { QuestionPoolModal } from '../QuestionPoolModal';
import { toast } from 'sonner';
import { questionService, type PoolConfig } from '../../../../services/question.service';
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
  points: number;
  difficulty: QuestionDifficulty | null;
  options?: string[];
  correctAnswer?: number | number[] | string;  // Support multiple correct answers for MCQ
  hasMultipleCorrect?: boolean; // Flag to indicate if MCQ has multiple correct answers
  chapterId?: number;
  optionIds?: number[];
  chapterIds?: number[];
  loIds?: number[];
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
}

interface QuestionsTabProps {
  examId: string | null;
  subjectId: string;
}

// Mock questions data per exam
const mockQuestionsData: Record<string, Question[]> = {
  '1': [
    {
      id: '1',
      type: 'mcq',
      question: 'What is normalization in database design?',
      points: 5,
      difficulty: 'medium',
      options: [
        'Process of organizing data to reduce redundancy',
        'Process of creating backups',
        'Process of encrypting data',
        'Process of indexing tables',
      ],
      correctAnswer: 0,
      hasMultipleCorrect: false,
    },
    {
      id: '1b',
      type: 'mcq',
      question: 'Which of the following are valid SQL aggregate functions? (Select all that apply)',
      points: 6,
      difficulty: 'medium',
      options: [
        'COUNT()',
        'SUM()',
        'AVG()',
        'CONCAT()',
      ],
      correctAnswer: [0, 1, 2],
      hasMultipleCorrect: true,
    },
    {
      id: '2',
      type: 'true-false',
      question: 'SQL is a declarative programming language.',
      points: 3,
      difficulty: 'easy',
      correctAnswer: 'true',
    },
    {
      id: '3',
      type: 'essay',
      question: 'Explain the differences between INNER JOIN and OUTER JOIN with examples.',
      points: 10,
      difficulty: 'hard',
    },
  ],
  '2': [
    {
      id: '1',
      type: 'mcq',
      question: 'Which normal form removes transitive dependencies?',
      points: 5,
      difficulty: 'medium',
      options: ['1NF', '2NF', '3NF', 'BCNF'],
      correctAnswer: 2,
      hasMultipleCorrect: false,
    },
    {
      id: '2',
      type: 'mcq',
      question: 'Which of the following are properties of a primary key? (Select all that apply)',
      points: 5,
      difficulty: 'easy',
      options: [
        'Must be unique',
        'Can contain NULL values',
        'Must be atomic',
        'Can be changed frequently',
      ],
      correctAnswer: [0, 2],
      hasMultipleCorrect: true,
    },
  ],
  '3': [
    {
      id: '1',
      type: 'mcq',
      question: 'What is the time complexity of binary search?',
      points: 4,
      difficulty: 'easy',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      correctAnswer: 1,
      hasMultipleCorrect: false,
    },
    {
      id: '2',
      type: 'mcq',
      question: 'Which data structures use LIFO (Last In First Out) principle? (Select all that apply)',
      points: 4,
      difficulty: 'easy',
      options: ['Stack', 'Queue', 'Deque (when used as stack)', 'Priority Queue'],
      correctAnswer: [0, 2],
      hasMultipleCorrect: true,
    },
    {
      id: '3',
      type: 'essay',
      question: 'Explain the differences between linked list and array data structures.',
      points: 10,
      difficulty: 'medium',
    },
  ],
  '4': [
    {
      id: '1',
      type: 'mcq',
      question: 'Which HTML tag is used for the largest heading?',
      points: 2,
      difficulty: 'easy',
      options: ['<h1>', '<h6>', '<header>', '<heading>'],
      correctAnswer: 0,
    },
    {
      id: '2',
      type: 'true-false',
      question: 'CSS stands for Cascading Style Sheets.',
      points: 2,
      difficulty: 'easy',
      correctAnswer: 'true',
    },
  ],
};

export function QuestionsTab({ examId, subjectId }: QuestionsTabProps) {
  // Load questions based on examId
  const initialQuestions: Question[] = [];

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(questions[0]?.id || null);
  const [showQuestionPool, setShowQuestionPool] = useState(false);
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null);
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [activePoolRuleId, setActivePoolRuleId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
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
        points: Number(question.question_point),
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
      if (!subjectId) {
        setChapters([]);
        setLearningObjectives([]);
        return;
      }
      try {
        setTaxonomyLoading(true);
        setTaxonomyError(null);
        const chapterRows = await teacherQuestionBankService.listChapters(subjectId);
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
  }, [subjectId, selectedQuestion, selectedQ?.chapterIds?.join(',')]);

  const addQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      type,
      question: '',
      points: 5,
      difficulty: 'medium',
      options: type === 'mcq' ? ['', ''] : undefined,
      chapterId: undefined,
      chapterIds: [],
      loIds: [],
      status: 'draft',
      correctAnswer: type === 'true-false' ? 'true' : 0,
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

  const loadPoolRuleCandidates = async (ruleId: number, questionToSelect?: string) => {
    if (!examId) return;
    try {
      setLoadingQuestions(true);
      setLoadError(null);
      const response = await questionService.getPoolRuleQuestions(Number(examId), ruleId);
      const mapped = mapQuestions(response.questions.map((question) => ({
        ...question,
        question_point: 1,
      })));
      setQuestions(mapped);
      setActivePoolRuleId(ruleId);
      setSelectedQuestion(questionToSelect ?? mapped[0]?.id ?? null);
      setSelectedIds(new Set());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load pool candidates.');
    } finally {
      setLoadingQuestions(false);
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

  const confirmDistribute = async () => {
    if (!examId) return;
    try {
      setBulkBusy(true);
      await questionService.distributePoints(Number(examId));
      setDistributeOpen(false);
      await loadQuestions(selectedQuestion ?? undefined);
      toast.success('Points distributed evenly and persisted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to distribute points.');
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
    if (!selectedQ.question.trim() || !subjectId || !selectedQ.difficulty) {
      setSaveError('Question text, subject, and difficulty are required.');
      return;
    }
    if (!Number.isFinite(selectedQ.points) || selectedQ.points <= 0) {
      setSaveError('Question points must be a positive number.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
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
          subject_id: subjectId,
          chapter_ids: selectedQ.chapterIds ?? [],
          lo_ids: selectedQ.loIds ?? [],
          question_status: selectedQ.status ?? 'draft',
          options,
          exam_id: Number(examId),
          question_point: selectedQ.points,
        });
        await loadQuestions(String(questionId));
      } else {
        const payload = {
          question_text: selectedQ.question.trim(),
          question_difficulties: selectedQ.difficulty,
          question_type: questionType,
          subject_id: subjectId,
          chapter_ids: selectedQ.chapterIds ?? [],
          lo_ids: selectedQ.loIds ?? [],
          question_status: selectedQ.status ?? 'draft',
          question_point: selectedQ.points,
          options,
        };
        if (isPoolMode && activePoolRuleId !== null) {
          const result = await questionService.updatePoolCandidate(
            Number(examId),
            activePoolRuleId,
            Number(selectedQ.id),
            payload,
          );
          await loadPoolRuleCandidates(activePoolRuleId, String(result.question_id));
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
      {/* Question List - Left */}
      <div className="lg:col-span-1 border-r border-gray-200 bg-gray-50">
        <div className="p-4 border-b border-gray-200 space-y-3">
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
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              MCQ
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addQuestion('true-false')}
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              T/F
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addQuestion('essay')}
              className="flex-1 text-xs"
            >
              <Plus className="size-3 mr-1" />
              Essay
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => setDistributeOpen(true)} disabled={questions.length === 0 || bulkBusy}>
              <Shuffle className="mr-1 size-3" /> Distribute Points Evenly
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkRemoveOpen(true)} disabled={selectedIds.size === 0 || bulkBusy} className="text-red-600">
              <Trash2 className="mr-1 size-3" /> Remove Selected ({selectedIds.size})
            </Button>
          </div>
          </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setShowQuestionPool(true)}
            disabled={!examId || examId.startsWith('new-')}
          >
            <Database className="size-4 mr-2" />
            Import from Question Bank
          </Button>
        </div>

        {isPoolMode && poolConfig && activePoolRuleId === null ? (
          /* Pool Configuration Summary */
          <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-400px)]">
            <div className="space-y-2">
              <h4 className="text-xs text-gray-700 uppercase">Subject</h4>
              <Badge variant="outline" className="bg-white">
                {poolConfig.subject_id}
              </Badge>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs text-gray-700 uppercase mb-2">Distribution</h4>
              {poolConfig.rules.map((rule) => (
                <Card key={rule.rule_id} className={`cursor-pointer shadow-sm ${activePoolRuleId === rule.rule_id ? 'border-purple-500' : ''}`} onClick={() => void loadPoolRuleCandidates(rule.rule_id)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-800">{rule.chapter_name}{rule.lo_name ? ` · ${rule.lo_name}` : ' · All LOs'}</span>
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
                      <span>Draw {rule.draw_count} questions</span>
                      <span className="text-gray-500">from {rule.available_count}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-teal-800">Total Per Student</span>
                <Badge className="bg-gradient-to-r from-teal-500 to-blue-600">
                  {poolConfig.total_questions}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
        <div className="overflow-y-auto h-[calc(100vh-400px)]">
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
                      <span className="text-xs text-gray-500 ml-auto">{question.points} pts</span>
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
                      className="p-1 hover:bg-gray-200 rounded"
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
      <div className="lg:col-span-2 p-6 overflow-y-auto h-[calc(100vh-200px)]">
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
                <Button variant="outline" size="sm">
                  <X className="size-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveQuestion} disabled={isSaving} className="bg-gradient-to-r from-teal-500 to-blue-600">
                  <Save className="size-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Question'}
                </Button>
              </div>
            </div>

            <Card className="shadow-md rounded-2xl border-0">
              <CardContent className="p-6 space-y-4">
                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Textarea
                    value={selectedQ.question}
                    onChange={(e) =>
                      updateQuestion(selectedQ.id, { question: e.target.value })
                    }
                    placeholder="Enter your question here..."
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
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
                    <Label>Points</Label>
                    <Input
                      type="number"
                      value={selectedQ.points}
                      onChange={(e) =>
                        updateQuestion(selectedQ.id, { points: Number(e.target.value) })
                      }
                      min="1"
                      step="0.01"
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
                              onChange={() => {
                                updateQuestion(selectedQ.id, { correctAnswer: index });
                              }}
                              className="size-4 text-teal-600 cursor-pointer"
                            />
                          )}
                          <Input
                            value={option}
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
                            disabled={selectedQ.options!.length <= 2}
                            onClick={() => removeOption(index)}
                            aria-label={`Remove option ${index + 1}`}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
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
      <AlertDialog open={distributeOpen} onOpenChange={(open) => { if (!bulkBusy) setDistributeOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Distribute points evenly?</AlertDialogTitle><AlertDialogDescription>The persisted exam total will be divided across all fixed questions. The final question receives any two-decimal rounding remainder.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={bulkBusy} onClick={(event) => { event.preventDefault(); void confirmDistribute(); }}>{bulkBusy ? 'Distributing...' : 'Distribute Points'}</AlertDialogAction></AlertDialogFooter>
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
