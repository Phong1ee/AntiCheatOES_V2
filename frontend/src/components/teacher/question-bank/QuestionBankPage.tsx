import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { SubjectSidebar } from './SubjectSidebar';
import { QuestionFilters } from './QuestionFilters';
import { QuestionList } from './QuestionList';
import { QuestionEditor } from './QuestionEditor';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { teacherQuestionBankService } from '../../../services/teacher-question-bank.service';
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionBankFilters,
  QuestionBankItem,
  QuestionBankTab,
  QuestionDetail,
  QuestionStatus,
  SubjectCount,
} from '../../../types/question-bank';

const pageSize = 12;
const statuses: Array<{ value: QuestionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);
  return debounced;
}

export function QuestionBankPage() {
  const [activeTab, setActiveTab] = useState<QuestionBankTab>('bank');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [filters, setFilters] = useState<QuestionBankFilters>({});
  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  const [totalSubjectCount, setTotalSubjectCount] = useState(0);
  const [noSubjectCount, setNoSubjectCount] = useState(0);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [learningObjectives, setLearningObjectives] = useState<LearningObjectiveSummary[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editorQuestionId, setEditorQuestionId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailQuestionId, setDetailQuestionId] = useState<number | null>(null);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const subject_id = selectedSubject === 'all' ? undefined : selectedSubject;
    return {
      ...filters,
      subject_id,
      search: debouncedSearch || undefined,
      page,
      page_size: pageSize,
    };
  }, [debouncedSearch, filters, page, selectedSubject]);

  const resetPagingAndFiltersForTab = (tab: QuestionBankTab) => {
    setActiveTab(tab);
    setSelectedSubject('all');
    setFilters({});
    setPage(1);
    setQuestions([]);
  };

  const refresh = () => setReloadKey((current) => current + 1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, selectedSubject]);

  useEffect(() => {
    let cancelled = false;
    setSubjectsLoading(true);
    teacherQuestionBankService
      .listSubjectCounts(activeTab)
      .then((data) => {
        if (cancelled) return;
        setSubjects(data.subjects);
        setTotalSubjectCount(data.total_count);
        setNoSubjectCount(data.no_subject_count);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Unable to load subjects.');
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadKey]);

  useEffect(() => {
    if (selectedSubject === 'all' || selectedSubject === '__none__') {
      setChapters([]);
      setLearningObjectives([]);
      setFilters((current) => ({ ...current, chapter_id: undefined, lo_id: undefined }));
      return;
    }

    let cancelled = false;
    teacherQuestionBankService
      .listChapters(selectedSubject)
      .then((items) => {
        if (cancelled) return;
        setChapters(items);
        setFilters((current) => ({
          ...current,
          chapter_id: current.chapter_id && items.some((chapter) => chapter.chapter_id === current.chapter_id) ? current.chapter_id : undefined,
          lo_id: undefined,
        }));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Unable to load chapters.'));
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);

  useEffect(() => {
    if (!filters.chapter_id) {
      setLearningObjectives([]);
      return;
    }

    let cancelled = false;
    teacherQuestionBankService
      .listLearningObjectives(filters.chapter_id)
      .then((items) => {
        if (cancelled) return;
        setLearningObjectives(items);
        setFilters((current) => ({
          ...current,
          lo_id: current.lo_id && items.some((lo) => lo.lo_id === current.lo_id) ? current.lo_id : undefined,
        }));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Unable to load learning objectives.'));
    return () => {
      cancelled = true;
    };
  }, [filters.chapter_id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = activeTab === 'bank' ? teacherQuestionBankService.listBank(queryParams) : teacherQuestionBankService.listMine(queryParams);
    request
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!cancelled) {
          setQuestions([]);
          setTotal(0);
          setError(err instanceof Error ? err.message : 'Unable to load questions.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, queryParams, reloadKey]);

  useEffect(() => {
    if (!detailQuestionId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    teacherQuestionBankService
      .getDetail(detailQuestionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : 'Unable to load question detail.');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailQuestionId]);

  const updateFilters = (nextFilters: QuestionBankFilters) => {
    setFilters(nextFilters);
  };

  const setStatusFilter = (statusValue: QuestionStatus | 'all') => {
    setFilters((current) => ({ ...current, status: statusValue === 'all' ? undefined : statusValue }));
  };

  const handleSubmit = async (questionId: number) => {
    try {
      await teacherQuestionBankService.submit(questionId);
      toast.success('Question submitted for approval.');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit question.');
    }
  };

  const handleDelete = async (questionId: number) => {
    try {
      await teacherQuestionBankService.remove(questionId);
      toast.success('Question deleted.');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete question.');
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl text-gray-800">Question Bank</h1>
            <p className="text-sm text-gray-600 mt-1">
              Browse approved questions or manage questions created by you.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((current) => !current)}
              className={showFilters ? 'bg-teal-50 border-teal-300' : ''}
            >
              <SlidersHorizontal className="size-4 mr-2" />
              Filters
            </Button>
            {activeTab === 'mine' && (
              <Button
                size="sm"
                onClick={() => {
                  setEditorQuestionId(null);
                  setEditorOpen(true);
                }}
                className="gap-2 bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="size-4" />
                New Question
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            <Button
              variant={activeTab === 'bank' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => resetPagingAndFiltersForTab('bank')}
              className={activeTab === 'bank' ? 'bg-white text-gray-900 hover:bg-white shadow-sm' : ''}
            >
              Question Bank
            </Button>
            <Button
              variant={activeTab === 'mine' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => resetPagingAndFiltersForTab('mine')}
              className={activeTab === 'mine' ? 'bg-white text-gray-900 hover:bg-white shadow-sm' : ''}
            >
              Your Questions
            </Button>
          </div>

          {activeTab === 'mine' && (
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <Button
                  key={status.value}
                  variant={filters.status === status.value || (!filters.status && status.value === 'all') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status.value)}
                  className={filters.status === status.value || (!filters.status && status.value === 'all') ? 'bg-teal-600 hover:bg-teal-700' : ''}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72">
          <SubjectSidebar
            activeTab={activeTab}
            selectedSubject={selectedSubject}
            subjects={subjects}
            totalCount={totalSubjectCount}
            noSubjectCount={noSubjectCount}
            loading={subjectsLoading}
            onSubjectSelect={setSelectedSubject}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <QuestionList
              activeTab={activeTab}
              questions={questions}
              loading={loading}
              error={error}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onView={setDetailQuestionId}
              onEdit={(questionId) => {
                setEditorQuestionId(questionId);
                setEditorOpen(true);
              }}
              onSubmit={handleSubmit}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {showFilters && (
          <div className="w-80">
            <QuestionFilters
              activeTab={activeTab}
              filters={filters}
              chapters={chapters}
              learningObjectives={learningObjectives}
              onFilterChange={updateFilters}
            />
          </div>
        )}
      </div>

      <QuestionEditor
        open={editorOpen}
        questionId={editorQuestionId}
        onClose={() => setEditorOpen(false)}
        onSaved={refresh}
      />

      <Dialog open={detailQuestionId !== null} onOpenChange={(open) => !open && setDetailQuestionId(null)}>
        <DialogContent className="question-detail-modal flex min-h-0 max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl">
          <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4 pr-14">
            <DialogTitle className="text-xl font-semibold text-gray-900">Question Detail</DialogTitle>
            <DialogDescription className="pt-1 text-sm text-gray-500">
              Review taxonomy, status, usage, and authorized answer details.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {detailLoading && <div className="h-48 rounded-none bg-gray-100 animate-pulse" />}
            {detailError && <div className="rounded-none border border-red-200 bg-red-50 p-5 text-red-800">{detailError}</div>}
            {detail && !detailLoading && (
              <div className="space-y-6">
                <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-md bg-white text-blue-700 border-blue-200">{detail.question_type}</Badge>
                    {detail.question_difficulties && (
                      <Badge variant="outline" className="rounded-md bg-white text-amber-700 border-amber-200">
                        {detail.question_difficulties}
                      </Badge>
                    )}
                    {activeTab === 'mine' && (
                      <Badge variant="outline" className="rounded-md bg-white text-gray-700 border-gray-200">
                        {detail.question_status}
                      </Badge>
                    )}
                    <Badge variant="outline" className="rounded-md bg-white text-gray-600 border-gray-200">
                      ID {detail.question_id}
                    </Badge>
                  </div>
                  <p className="text-lg leading-relaxed text-gray-950 whitespace-pre-wrap">{detail.question_text}</p>
                  {detail.rejected_feedback && (
                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      Rejected reason: {detail.rejected_feedback}
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Subject</p>
                    <p className="text-sm text-gray-900">
                      {detail.subject ? `${detail.subject.subject_id} - ${detail.subject.subject_name}` : 'No Subject'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Creator</p>
                    <p className="text-sm text-gray-900">{detail.creator?.full_name ?? 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Used in exams</p>
                    <p className="text-sm text-gray-900">{detail.usage_count ?? 0}</p>
                  </div>
                </section>

                <section className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  <div className="self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Chapters</p>
                    {detail.chapters.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">None</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detail.chapters.map((chapter) => (
                          <Badge key={chapter.chapter_id} variant="outline" className="rounded-md bg-gray-50 text-gray-700 border-gray-200">
                            {chapter.chapter_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Learning Objectives</p>
                    {detail.learning_objectives.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">None</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detail.learning_objectives.map((lo) => (
                          <Badge key={lo.lo_id} variant="outline" className="rounded-md bg-gray-50 text-gray-700 border-gray-200">
                            {lo.lo_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-base font-medium text-gray-900">Answers</h3>
                    {detail.question_type === 'MCQ' && (
                      <span className="text-xs text-gray-500">{detail.options.length} options</span>
                    )}
                  </div>
                  {detail.question_type === 'essay' && <p className="text-sm text-gray-500">No suggested answer provided.</p>}
                  {detail.question_type !== 'essay' && (
                    <div className="space-y-3">
                      {detail.options.map((option, index) => (
                        <div
                          key={option.options_id ?? index}
                          className={`question-detail-option-row flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                            option.is_correct ? 'question-detail-option-row-correct' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <span className={`shrink-0 text-sm font-semibold ${
                            option.is_correct ? 'text-emerald-600' : 'text-gray-700'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <p className={`min-w-0 flex-1 text-sm leading-6 ${
                            option.is_correct ? 'font-semibold text-emerald-600' : 'text-gray-800'
                          }`}>{option.options_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 items-center border-t border-gray-200 bg-white px-6 py-4">
            <DialogClose asChild>
              <Button className="rounded-lg bg-teal-600 hover:bg-teal-700">
                <X className="size-4 mr-2" />
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
