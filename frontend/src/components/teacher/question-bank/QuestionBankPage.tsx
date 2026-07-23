import { useEffect, useMemo, useRef, useState } from "react";
import { SubjectSidebar } from "./SubjectSidebar";
import { QuestionFilters } from "./QuestionFilters";
import { BankQuestionList } from "./BankQuestionList";
import { YourQuestionsList } from "./YourQuestionsList";
import { QuestionEditor } from "./QuestionEditor";
import { QuestionDetailModal } from "./QuestionDetailModal";
import { Search, Library, User, Database } from "lucide-react";
import { toast } from "sonner";
import { teacherQuestionBankService } from "../../../services/teacher-question-bank.service";
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionBankFilters,
  QuestionBankItem,
  QuestionBankTab,
  QuestionDetail,
  QuestionStatus,
  SubjectCount,
} from "../../../types/question-bank";

const pageSize = 12;

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);
  return debounced;
}

export function QuestionBankPage() {
  const [activeTab, setActiveTab] = useState<QuestionBankTab>("bank");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [filters, setFilters] = useState<QuestionBankFilters>({});
  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  const [totalSubjectCount, setTotalSubjectCount] = useState(0);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [learningObjectives, setLearningObjectives] = useState<
    LearningObjectiveSummary[]
  >([]);
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
    const { chapter_id, lo_id, ...questionFilters } = filters;
    const subject_id = selectedSubject === "all" ? undefined : selectedSubject;
    const shouldSendTaxonomy =
      selectedSubject !== "all" && selectedSubject !== "__none__";
    return {
      ...questionFilters,
      ...(shouldSendTaxonomy ? { chapter_id, lo_id } : {}),
      subject_id,
      search: debouncedSearch || undefined,
      page,
      page_size: pageSize,
    };
  }, [debouncedSearch, filters, page, selectedSubject]);

  const queryIdentity = useMemo(
    () =>
      JSON.stringify({ activeTab, debouncedSearch, filters, selectedSubject }),
    [activeTab, debouncedSearch, filters, selectedSubject],
  );
  const lastFetchedQueryIdentity = useRef(queryIdentity);

  const resetPagingAndFiltersForTab = (tab: QuestionBankTab) => {
    setActiveTab(tab);
    setSelectedSubject("all");
    setFilters({});
    setPage(1);
    setQuestions([]);
  };

  const refresh = () => setReloadKey((current) => current + 1);

  const statusCounts = useMemo(() => {
    const counts: Record<QuestionStatus | "all", number> = {
      all: questions.length,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    questions.forEach((question) => {
      counts[question.question_status] += 1;
    });

    return counts;
  }, [questions]);

  const mobileSubjectItems = useMemo(
    () => [
      {
        id: "all",
        name: "All Subjects",
        count: totalSubjectCount,
      },
      ...subjects.map((subject) => ({
        id: subject.subject_id,
        name: subject.subject_name,
        count: subject.question_count,
      })),
    ],
    [subjects, totalSubjectCount],
  );

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
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(
            err instanceof Error ? err.message : "Unable to load subjects.",
          );
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadKey]);

  useEffect(() => {
    if (selectedSubject === "all" || selectedSubject === "__none__") {
      setChapters([]);
      setLearningObjectives([]);
      setFilters((current) =>
        current.chapter_id || current.lo_id
          ? { ...current, chapter_id: undefined, lo_id: undefined }
          : current,
      );
      return;
    }

    let cancelled = false;
    teacherQuestionBankService
      .listChapters(selectedSubject)
      .then((items) => {
        if (cancelled) return;
        setChapters(items);
        setFilters((current) => {
          const chapter_id =
            current.chapter_id &&
            items.some((chapter) => chapter.chapter_id === current.chapter_id)
              ? current.chapter_id
              : undefined;
          if (current.chapter_id === chapter_id && current.lo_id === undefined)
            return current;
          return { ...current, chapter_id, lo_id: undefined };
        });
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Unable to load chapters.",
        ),
      );
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
        setFilters((current) => {
          const lo_id =
            current.lo_id && items.some((lo) => lo.lo_id === current.lo_id)
              ? current.lo_id
              : undefined;
          return current.lo_id === lo_id ? current : { ...current, lo_id };
        });
      })
      .catch((err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to load learning objectives.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [filters.chapter_id]);

  useEffect(() => {
    let cancelled = false;
    if (page !== 1 && lastFetchedQueryIdentity.current !== queryIdentity)
      return;
    lastFetchedQueryIdentity.current = queryIdentity;
    setLoading(true);
    setError(null);
    const request =
      activeTab === "bank"
        ? teacherQuestionBankService.listBank(queryParams)
        : teacherQuestionBankService.listMine(queryParams);
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
          setError(
            err instanceof Error ? err.message : "Unable to load questions.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, page, queryIdentity, queryParams, reloadKey]);

  useEffect(() => {
    if (!detailQuestionId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    setDetailError(null);
    teacherQuestionBankService
      .getDetail(detailQuestionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled)
          setDetailError(
            err instanceof Error
              ? err.message
              : "Unable to load question detail.",
          );
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

  const setStatusFilter = (statusValue: QuestionStatus | "all") => {
    setFilters((current) => ({
      ...current,
      status: statusValue === "all" ? undefined : statusValue,
    }));
  };

  const handleSubmit = async (questionId: number) => {
    try {
      await teacherQuestionBankService.submit(questionId);
      toast.success("Question submitted for approval.");
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to submit question.",
      );
    }
  };

  const handleDelete = async (questionId: number) => {
    try {
      await teacherQuestionBankService.remove(questionId);
      toast.success("Question deleted.");
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to delete question.",
      );
    }
  };

  const closeDetail = () => {
    setDetailQuestionId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 text-gray-800">
      <div className="hidden w-56 shrink-0 min-w-0 md:block">
        <SubjectSidebar
          selectedSubject={selectedSubject}
          subjects={subjects}
          totalCount={totalSubjectCount}
          loading={subjectsLoading}
          onSubjectSelect={setSelectedSubject}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-gray-100 bg-white px-4 py-4 md:px-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Database className="size-4" />
              </span>
              <div>
                <h1 className="m-0 text-base font-semibold leading-tight text-gray-800">
                  Question Bank
                </h1>
                <p className="m-0 mt-0.5 text-xs leading-tight text-gray-400">
                  {activeTab === "bank"
                    ? "Browse the central question library"
                    : "Questions you have created"}
                </p>
              </div>
            </div>
          </div>

          <div
            className="mb-4 inline-flex max-w-full items-center gap-1 rounded-xl bg-gray-100 p-1"
            role="tablist"
            aria-label="Question bank sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "bank"}
              className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border-0 px-4 py-1.5 font-[inherit] text-sm font-medium leading-5 transition-all max-[480px]:px-3 [&_svg]:size-3.5 ${
                activeTab === "bank"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => resetPagingAndFiltersForTab("bank")}
            >
              <Library />
              Question Bank
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "mine"}
              className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border-0 px-4 py-1.5 font-[inherit] text-sm font-medium leading-5 transition-all max-[480px]:px-3 [&_svg]:size-3.5 ${
                activeTab === "mine"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => resetPagingAndFiltersForTab("mine")}
            >
              <User />
              Your Questions
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 max-md:items-stretch">
            <div className="relative min-w-48 flex-1 basis-[280px] md:max-w-sm max-md:w-full max-md:max-w-none max-md:basis-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  activeTab === "bank"
                    ? "Search questions, topics, tags..."
                    : "Search your questions..."
                }
                className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 font-[inherit] text-sm leading-5 text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-300/40"
              />
            </div>

            {activeTab === "bank" && (
              <QuestionFilters
                selectedSubject={selectedSubject}
                filters={filters}
                chapters={chapters}
                learningObjectives={learningObjectives}
                onFilterChange={updateFilters}
              />
            )}
          </div>

          {activeTab === "bank" && (
            <div className="hidden gap-2 overflow-x-auto pb-1 pt-4 max-md:flex">
              {subjectsLoading
                ? [0, 1, 2].map((item) => (
                    <span
                      key={item}
                      className="inline-flex min-h-[34px] w-28 shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 opacity-[0.55]"
                    />
                  ))
                : mobileSubjectItems.map((subject) => {
                    const active = selectedSubject === subject.id;
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        className={`inline-flex min-h-[34px] shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-[inherit] text-xs font-medium ${
                          active
                            ? "border-teal-200 bg-teal-50 text-teal-700"
                            : "border-gray-200 bg-white text-gray-600"
                        }`}
                        onClick={() => setSelectedSubject(subject.id)}
                      >
                        <span className="max-w-28 truncate">
                          {subject.name}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            active
                              ? "bg-white text-teal-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {subject.count}
                        </span>
                      </button>
                    );
                  })}
            </div>
          )}
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="mx-auto w-full max-w-4xl">
            {activeTab === "bank" ? (
              <BankQuestionList
                questions={questions}
                loading={loading}
                error={error}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onView={setDetailQuestionId}
              />
            ) : (
              <YourQuestionsList
                questions={questions}
                loading={loading}
                error={error}
                total={total}
                page={page}
                pageSize={pageSize}
                statusFilter={filters.status ?? "all"}
                statusCounts={statusCounts}
                onStatusFilterChange={setStatusFilter}
                onNewQuestion={() => {
                  setEditorQuestionId(null);
                  setEditorOpen(true);
                }}
                onPageChange={setPage}
                onView={setDetailQuestionId}
                onEdit={(questionId) => {
                  setEditorQuestionId(questionId);
                  setEditorOpen(true);
                }}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </section>
      </main>

      <QuestionEditor
        open={editorOpen}
        questionId={editorQuestionId}
        onClose={() => setEditorOpen(false)}
        onSaved={refresh}
      />

      <QuestionDetailModal
        open={detailQuestionId !== null}
        activeTab={activeTab}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
      />
    </div>
  );
}
