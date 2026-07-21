// @ts-ignore: Allow side-effect CSS import without type declarations
import './QuestionPoolModal.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Database, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  questionService,
  type QuestionImportCandidate,
  type QuestionImportCandidateResponse,
} from '../../../services/question.service';
import type { QuestionDifficulty, QuestionStatus, QuestionType } from '../../../types/question-bank';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

interface QuestionPoolModalProps {
  examId: number;
  existingQuestionIds: number[];
  onClose: () => void;
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
  current_teacher_id: 0,
};

export function QuestionPoolModal({ examId, existingQuestionIds, onClose, onImported }: QuestionPoolModalProps) {
  const [questions, setQuestions] = useState<QuestionImportCandidate[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<Record<number, number>>({});
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
  const [importing, setImporting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const requestSequence = useRef(0);
  const questionListRef = useRef<HTMLDivElement>(null);
  const existingIds = useMemo(() => new Set(existingQuestionIds), [existingQuestionIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
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
          created_by: createdBy === 'all' ? undefined : Number(createdBy),
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
  }, [examId, debouncedSearch, questionType, difficulty, subjectId, questionStatus, createdBy, page, pageSize]);

  useEffect(() => {
    questionListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [page, pageSize, debouncedSearch, questionType, difficulty, subjectId, questionStatus, createdBy]);

  const selectedIds = Object.keys(selectedPoints).map(Number);
  const selectablePageIds = questions
    .filter((question) => !question.already_added && !existingIds.has(question.question_id))
    .map((question) => question.question_id);
  const allPageSelected = selectablePageIds.length > 0
    && selectablePageIds.every((questionId) => questionId in selectedPoints);
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = total === 0 ? 0 : Math.min(page * pageSize, total);

  const resetPage = () => setPage(1);
  const toggleQuestion = (questionId: number) => {
    setSelectedPoints((current) => {
      const next = { ...current };
      if (questionId in next) delete next[questionId];
      else next[questionId] = 1;
      return next;
    });
  };
  const togglePageSelection = () => {
    setSelectedPoints((current) => {
      const next = { ...current };
      if (allPageSelected) selectablePageIds.forEach((id) => delete next[id]);
      else selectablePageIds.forEach((id) => { if (!(id in next)) next[id] = 1; });
      return next;
    });
  };
  const updatePoints = (questionId: number, rawValue: string) => {
    const value = Number(rawValue);
    setSelectedPoints((current) => ({
      ...current,
      [questionId]: rawValue.trim() !== '' && Number.isFinite(value) ? value : Number.NaN,
    }));
  };

  const importQuestions = async () => {
    const payload = selectedIds.map((questionId) => ({ question_id: questionId, question_point: selectedPoints[questionId] }));
    if (payload.some((item) => !Number.isInteger(item.question_point) || item.question_point <= 0)) {
      setError('Every selected question must have a positive integer point value.');
      return;
    }
    try {
      setImporting(true);
      setError(null);
      const result = await questionService.importFromBank(examId, payload);
      await onImported();
      setSelectedPoints({});
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
          <Button className="shrink-0" variant="ghost" size="sm" onClick={onClose} disabled={importing} aria-label="Close"><X className="size-5" /></Button>
        </div>

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
            <Select value={createdBy} onValueChange={(value) => { setCreatedBy(value); resetPage(); }}><SelectTrigger><SelectValue placeholder="Created By" /></SelectTrigger><SelectContent><SelectItem value="all">All Creators</SelectItem>{metadata.creators.map((creator) => <SelectItem key={creator.id} value={String(creator.id)}>{creator.id === metadata.current_teacher_id ? `Me · ${creator.full_name}` : creator.full_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="question-pool-modal-header items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={togglePageSelection} disabled={loading || importing || selectablePageIds.length === 0}>{allPageSelected ? 'Deselect Current Page' : 'Select All on Current Page'}</Button>
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
              const selected = question.question_id in selectedPoints;
              const pointsInputId = `question-points-${question.question_id}`;
              const subjectLabel = question.subject
                ? `${question.subject.subject_id} · ${question.subject.subject_name}`
                : '';
              const creatorLabel = question.creator
                ? `By ${question.creator.id === metadata.current_teacher_id ? 'Me' : question.creator.full_name}`
                : '';
              return <Card key={question.question_id} className={selected ? 'border-teal-500 bg-teal-50/30' : ''}><CardContent className="flex min-w-0 items-start gap-3 p-3 sm:gap-4 sm:p-4">
                <input type="checkbox" checked={selected} disabled={alreadyAdded || importing} onChange={() => toggleQuestion(question.question_id)} className="mt-1 size-4 shrink-0" aria-label={`Select question ${question.question_id}`} />
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
                    {selected && <div className="ml-auto flex shrink-0 items-center gap-1.5"><label htmlFor={pointsInputId} className="text-xs text-gray-600">Points</label><Input id={pointsInputId} aria-label={`Points for question ${question.question_id}`} type="number" min="1" step="1" value={Number.isFinite(selectedPoints[question.question_id]) ? selectedPoints[question.question_id] : ''} onChange={(event) => updatePoints(question.question_id, event.target.value)} disabled={importing} className="h-8 w-16 px-2 text-center" /></div>}
                  </div>
                  <p className="w-full whitespace-normal break-words text-sm text-gray-800">{question.question_text}</p>
                  {question.question_type === 'MCQ' && <p className="mt-1 text-xs text-gray-500">{question.option_count} options</p>}
                </div>
              </CardContent></Card>;
            })}</div>}
        </div>

        <div className="question-pool-modal-footer border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600"><span>Showing {firstShown}–{lastShown} of {total} questions</span><span>Page {totalPages === 0 ? 0 : page} of {totalPages}</span><div className="flex gap-1"><Button variant="outline" size="sm" aria-label="First page" onClick={() => setPage(1)} disabled={loading || page <= 1 || totalPages === 0}><ChevronsLeft className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1 || totalPages === 0}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || totalPages === 0 || page >= totalPages}><ChevronRight className="size-4" /></Button><Button variant="outline" size="sm" aria-label="Last page" onClick={() => setPage(totalPages)} disabled={loading || totalPages === 0 || page >= totalPages}><ChevronsRight className="size-4" /></Button></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-gray-600">{selectedIds.length} selected across all pages</span><div className="flex justify-end gap-2 sm:gap-3"><Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button><Button onClick={() => void importQuestions()} disabled={loading || importing || selectedIds.length === 0} className="bg-gradient-to-r from-teal-500 to-blue-600">{importing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{importing ? 'Importing...' : `Import ${selectedIds.length || ''}`.trim()}</Button></div></div>
        </div>
      </div>
    </div>
  );
}
