import './QuestionPoolModal.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Database, Loader2, Search, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  questionService,
  type QuestionImportCandidate,
  type QuestionImportCandidateResponse,
  type PoolConfig,
} from '../../../services/question.service';
import type { QuestionDifficulty, QuestionStatus, QuestionType } from '../../../types/question-bank';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PoolConfigurationBuilder, type PoolDraft } from './PoolConfigurationBuilder';

interface QuestionPoolModalProps {
  examId: number;
  existingQuestionIds: number[];
  subjectId: string;
  expectedVersion?: number;
  initialPoolConfig: PoolConfig | null;
  poolDraft: PoolDraft | null;
  onPoolDraftChange: (draft: PoolDraft | null) => void;
  /** False in pool mode, where hand-picking individual questions does nothing. */
  allowManual?: boolean;
  onClose: () => void;
  /** Import lands in the exam right away; the host reloads its list. */
  onImported: () => Promise<void>;
}

const statusClass: Record<QuestionImportCandidate['question_status'], string> = {
  approved: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

const emptyMetadata: QuestionImportCandidateResponse['filter_options'] = {
  subjects: [],
  creators: [],
  statuses: [],
  current_teacher_school_id: '',
};

export function QuestionPoolModal({ examId, existingQuestionIds, subjectId: examSubjectId, initialPoolConfig, poolDraft, onPoolDraftChange, allowManual = true, expectedVersion, onClose, onImported, onPoolSaved }: QuestionPoolModalProps) {
  const [mode, setMode] = useState<'manual' | 'pool'>(allowManual ? 'manual' : 'pool');
  const [questions, setQuestions] = useState<QuestionImportCandidate[]>([]);
  // Whole candidates (not just ids) so a multi-page selection can be staged
  // without refetching pages the teacher already left.
  const [selected, setSelected] = useState<Map<number, QuestionImportCandidate>>(() => new Map());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType | 'all'>('all');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'all'>('all');
  const [subjectId, setSubjectId] = useState('all');
  const [questionStatus, setQuestionStatus] = useState<QuestionStatus | 'all'>('all');
  const [createdBy, setCreatedBy] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [importing, setImporting] = useState(false);
  const requestSequence = useRef(0);
  const questionListRef = useRef<HTMLDivElement>(null);
  const existingIds = useMemo(() => new Set(existingQuestionIds), [existingQuestionIds]);

  useEffect(() => {
    if (mode !== 'manual') return;
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (mode !== 'manual') return;
    const sequence = ++requestSequence.current;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await questionService.listImportCandidates(examId, {
          search: debouncedSearch || undefined,
          question_type: questionType === 'all' ? undefined : questionType,
          difficulty: difficulty === 'all' ? undefined : difficulty,
          subject_id: subjectId === 'all' ? undefined : subjectId,
          status: questionStatus === 'all' ? undefined : questionStatus,
          created_by: createdBy === 'all' ? undefined : createdBy,
          page,
          page_size: pageSize,
        });
        if (sequence !== requestSequence.current) return;
        setQuestions(response.items);
        setTotal(response.total);
        setTotalPages(response.total_pages);
        setMetadata(response.filter_options);
        if (response.total_pages > 0 && page > response.total_pages) setPage(response.total_pages);
      } catch (loadError) {
        if (sequence === requestSequence.current) {
          setQuestions([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load question bank.');
        }
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    };
    void load();
  }, [examId, debouncedSearch, questionType, difficulty, subjectId, questionStatus, createdBy, page, pageSize, mode]);

  useEffect(() => {
    questionListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [page, pageSize, debouncedSearch, questionType, difficulty, subjectId, questionStatus, createdBy]);

  const selectedIds = Array.from(selected.keys());
  const selectablePageIds = questions
    .filter((question) => !question.already_added && !existingIds.has(question.question_id))
    .map((question) => question.question_id);
  const allPageSelected = selectablePageIds.length > 0
    && selectablePageIds.every((questionId) => selected.has(questionId));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = total === 0 ? 0 : Math.min(page * pageSize, total);

  const resetPage = () => setPage(1);
  const toggleQuestion = (question: QuestionImportCandidate) => {
    if (existingIds.has(question.question_id)) return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(question.question_id)) next.delete(question.question_id);
      else next.set(question.question_id, question);
      return next;
    });
  };
  const togglePageSelection = () => {
    setSelected((current) => {
      const next = new Map(current);
      const selectable = questions.filter((question) => selectablePageIds.includes(question.question_id));
      if (allPageSelected) selectable.forEach((question) => next.delete(question.question_id));
      else selectable.forEach((question) => next.set(question.question_id, question));
      return next;
    });
  };

  // Importing only adds rows, so it is applied straight away rather than being
  // queued behind "Save Questions".
  const importSelected = async () => {
    const payload = [...selected.keys()]
      .filter((questionId) => !existingIds.has(questionId))
      .map((questionId) => ({ question_id: questionId, ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}) }));
    if (payload.length === 0) return;
    try {
      setImporting(true);
      setError(null);
      const result = await questionService.importFromBank(examId, payload);
      await onImported();
      setSelected(new Map());
      toast.success(`${result.imported_count} question${result.imported_count === 1 ? '' : 's'} imported.`);
      onClose();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Unable to import questions.';
      setError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4">
      <div className="question-pool-modal-panel max-w-6xl rounded-xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="question-pool-modal-header flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg text-gray-800 sm:text-xl"><Database className="size-5 shrink-0 text-teal-600" /><span className="truncate">Import from Question Bank</span></h2><p className="mt-1 hidden text-sm text-gray-500 sm:block">Approved questions and your draft or pending questions are available.</p></div>
          <Button className="shrink-0" variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
        </div>

        {allowManual && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-3 sm:px-6">
            <Button type="button" size="sm" variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}><Database className="mr-2 size-4" />Pick questions myself</Button>
            <Button type="button" size="sm" variant={mode === 'pool' ? 'default' : 'outline'} onClick={() => setMode('pool')}><Settings2 className="mr-2 size-4" />Draw questions automatically</Button>
            <p className="w-full text-xs text-gray-500 sm:w-auto sm:pl-2">
              {mode === 'manual'
                ? 'Choose the exact questions every student will see.'
                : 'Describe the mix you want and let the system draw the questions.'}
            </p>
          </div>
        )}

        {mode === 'manual' ? (
        <>
        <div className="question-pool-modal-toolbar space-y-3 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="relative">
            {!searchFocused && !search && <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />}
            <Input value={search} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search question text" className="pl-10" />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Select value={questionType} onValueChange={(value: QuestionType | 'all') => { setQuestionType(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Question Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="MCQ">MCQ</SelectItem><SelectItem value="essay">Essay</SelectItem><SelectItem value="true-false">True/False</SelectItem></SelectContent></Select>
            <Select value={difficulty} onValueChange={(value: QuestionDifficulty | 'all') => { setDifficulty(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger><SelectContent><SelectItem value="all">All Difficulties</SelectItem><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
            <Select value={subjectId} onValueChange={(value) => { setSubjectId(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All Subjects</SelectItem>{metadata.subjects.map((subject) => <SelectItem key={subject.subject_id} value={subject.subject_id}>{subject.subject_id} · {subject.subject_name}</SelectItem>)}</SelectContent></Select>
            <Select value={questionStatus} onValueChange={(value: QuestionStatus | 'all') => { setQuestionStatus(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{metadata.statuses.map((status) => <SelectItem key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</SelectItem>)}</SelectContent></Select>
            <Select value={createdBy} onValueChange={(value) => { setCreatedBy(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Created By" /></SelectTrigger><SelectContent><SelectItem value="all">All Creators</SelectItem>{metadata.creators.map((creator) => <SelectItem key={creator.school_id} value={creator.school_id}>{creator.school_id === metadata.current_teacher_school_id ? `Me · ${creator.full_name}` : creator.full_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="question-pool-modal-header items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={togglePageSelection} disabled={loading || selectablePageIds.length === 0}>{allPageSelected ? 'Deselect Current Page' : 'Select All on Current Page'}</Button>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value) as 10 | 20); resetPage(); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 per page</SelectItem><SelectItem value="20">20 per page</SelectItem></SelectContent></Select>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <div
          ref={questionListRef}
          className="question-pool-modal-list p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 sm:p-6"
          aria-label="Question list"
          role="region"
          tabIndex={0}
        >
          {loading ? <div className="flex h-48 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" /> Loading questions...</div>
            : questions.length === 0 ? <div className="flex h-48 items-center justify-center text-gray-500">No questions match the current filters.</div>
            : <div className="space-y-3">{questions.map((question) => {
              const alreadyAdded = question.already_added || existingIds.has(question.question_id);
              const isSelected = selected.has(question.question_id);
              const disabled = alreadyAdded || importing;
              const subjectLabel = question.subject
                ? `${question.subject.subject_id} · ${question.subject.subject_name}`
                : '';
              const creatorLabel = question.creator
                ? `By ${question.creator.school_id === metadata.current_teacher_school_id ? 'Me' : question.creator.full_name}`
                : '';
              return <Card
                key={question.question_id}
                role={disabled ? undefined : 'checkbox'}
                aria-checked={disabled ? undefined : isSelected}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : 0}
                onClick={disabled || importing ? undefined : () => toggleQuestion(question)}
                onKeyDown={disabled ? undefined : (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleQuestion(question);
                  }
                }}
                className={`question-import-card ${isSelected ? 'border-teal-500 bg-teal-50/30' : ''} ${disabled ? 'question-import-card-disabled' : 'question-import-card-selectable'}`}
              ><CardContent className="flex min-w-0 items-start gap-3 p-3 sm:gap-4 sm:p-4">
                <input type="checkbox" checked={isSelected} disabled={disabled} onClick={(event) => event.stopPropagation()} onChange={() => toggleQuestion(question)} className="mt-1 size-4 shrink-0" aria-label={`Select question ${question.question_id}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex min-w-0 items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Badge variant="outline">{question.question_type}</Badge>
                      <Badge variant="outline">{question.question_difficulties ?? 'Difficulty not set'}</Badge>
                      <Badge className={statusClass[question.question_status]}>{question.question_status}</Badge>
                      {question.subject && <Badge variant="outline" className="max-w-full sm:max-w-52"><span className="truncate" title={subjectLabel}>{subjectLabel}</span></Badge>}
                      {question.creator && <Badge variant="outline" className="max-w-full sm:max-w-44"><span className="truncate" title={creatorLabel}>{creatorLabel}</span></Badge>}
                      {alreadyAdded && <Badge variant="secondary">Already added</Badge>}
                    </div>
                  </div>
                  <p className="w-full whitespace-normal break-words text-sm text-gray-800">{question.question_text}</p>
                  {question.question_type === 'MCQ' && <p className="mt-1 text-xs text-gray-500">{question.option_count} options</p>}
                </div>
              </CardContent></Card>;
            })}</div>}
        </div>

        <div className="question-pool-modal-footer border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600"><span>Showing {firstShown}–{lastShown} of {total} questions</span><span>Page {totalPages === 0 ? 0 : page} of {totalPages}</span><div className="flex gap-1"><Button variant="outline" size="sm" aria-label="First page" onClick={() => setPage(1)} disabled={loading || page <= 1 || totalPages === 0}><ChevronsLeft className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1 || totalPages === 0}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || totalPages === 0 || page >= totalPages}><ChevronRight className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Last page" onClick={() => setPage(totalPages)} disabled={loading || totalPages === 0 || page >= totalPages}><ChevronsRight className="size-4" /></Button></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-gray-600">{selectedIds.length} selected across all pages</span><div className="flex justify-end gap-2 sm:gap-3"><Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button><Button onClick={() => void importSelected()} disabled={loading || importing || selectedIds.length === 0} className="bg-gradient-to-r from-teal-500 to-blue-600">{importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{importing ? 'Importing...' : `Import ${selectedIds.length || ''}`.trim()}</Button></div></div>
        </div>
        </>
        ) : (
          <div className="question-pool-modal-list overflow-y-auto p-4 sm:p-6">
            <PoolConfigurationBuilder
              examId={examId}
          subjectId={examSubjectId}
          expectedVersion={expectedVersion}
          initialConfig={initialPoolConfig}
          draft={poolDraft}
          onDraftChange={onPoolDraftChange}
          onDone={onClose}
          onSaved={async (config) => {
            if (onPoolSaved) {
              await onPoolSaved(config);
            }
            onClose();
          }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
