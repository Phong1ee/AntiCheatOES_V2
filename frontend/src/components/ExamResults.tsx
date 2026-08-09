import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  Eye,
  EyeOff,
  FileText,
  Hourglass,
  RefreshCw,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ExamResultsStats } from "./exam-results/ExamResultsStats";
import { studentResultService } from "../services/student-result.service";
import type { StudentExamResult, StudentExamResultGroup } from "../types/student-result";
import { normalizeSearchText } from "../utils/search";

interface ExamResultsProps {
  onViewDetails: (attemptId: number, examId: number) => void;
  initialExamId?: string | number | null;
}

type SortOption = "date-desc" | "score-asc" | "score-desc";
type ResultStatus = "passed" | "failed" | "pending" | "hidden";
type StatusFilter = "all" | ResultStatus;

const strategyLabel = { highest: "Highest attempt", average: "Average attempts", last_attempt: "Last attempt" };

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "date-desc", label: "Date (Newest)" },
  { value: "score-asc", label: "Score (Lowest First)" },
  { value: "score-desc", label: "Score (Highest First)" },
];

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending Grading" },
  { value: "hidden", label: "Result Hidden" },
];

const groupStatus = (group: StudentExamResultGroup): ResultStatus => {
  if (group.gradingPending) return "pending";
  if (!group.latestAttempt.scoreVisible || group.finalScore === null) return "hidden";
  if (group.passingScore === null) return "hidden";
  return group.finalScore >= group.passingScore ? "passed" : "failed";
};

const GROUP_THEME: Record<ResultStatus, {
  card: string;
  iconBg: string;
  iconText: string;
  badge: string;
  badgeLabel: string;
  badgeIcon: LucideIcon;
  scoreBox: string;
  scoreText: string;
}> = {
  passed: {
    card: "border-green-200 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 via-white to-white",
    iconBg: "bg-green-100",
    iconText: "text-green-700",
    badge: "bg-green-100 text-green-700 border-green-200",
    badgeLabel: "Passed",
    badgeIcon: CheckCircle2,
    scoreBox: "border-green-200 bg-green-50",
    scoreText: "text-green-700",
  },
  failed: {
    card: "border-red-200 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 via-white to-white",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    badge: "bg-red-100 text-red-700 border-red-200",
    badgeLabel: "Failed",
    badgeIcon: XCircle,
    scoreBox: "border-red-200 bg-red-50",
    scoreText: "text-red-700",
  },
  pending: {
    card: "border-amber-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 via-white to-white",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    badgeLabel: "Pending Grading",
    badgeIcon: Hourglass,
    scoreBox: "border-amber-200 bg-amber-50",
    scoreText: "text-amber-800",
  },
  hidden: {
    card: "border-slate-200 border-l-4 border-l-slate-400 bg-gradient-to-br from-slate-50 via-white to-white",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    badgeLabel: "Result Hidden",
    badgeIcon: EyeOff,
    scoreBox: "border-slate-200 bg-slate-50",
    scoreText: "text-slate-600",
  },
};

const attemptTime = (attempt: StudentExamResult) =>
  new Date(attempt.submittedAt ?? attempt.startedAt ?? attempt.date ?? 0).getTime() || 0;

const formatDate = (date?: string | null) => {
  const value = date && new Date(date);
  return value && !Number.isNaN(value.getTime())
    ? value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "Date unavailable";
};

const sortAttempts = (attempts: StudentExamResult[]) =>
  [...attempts].sort((a, b) => (b.attemptNumber ?? -1) - (a.attemptNumber ?? -1) || attemptTime(b) - attemptTime(a));

export function ExamResults({ onViewDetails, initialExamId }: ExamResultsProps) {
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(
    initialExamId === null || initialExamId === undefined ? null : String(initialExamId),
  );
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [attemptSortBy, setAttemptSortBy] = useState<SortOption>("date-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults(await studentResultService.list());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load exam results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setSelectedExamId(initialExamId === null || initialExamId === undefined ? null : String(initialExamId));
  }, [initialExamId]);

  const groups = useMemo<StudentExamResultGroup[]>(() => {
    const grouped = new Map<number, StudentExamResult[]>();
    results.forEach((attempt) => grouped.set(attempt.examId, [...(grouped.get(attempt.examId) ?? []), attempt]));
    return [...grouped.entries()]
      .map(([examId, attempts]) => {
        const ordered = sortAttempts(attempts);
        const latest = ordered[0];
        return {
          examId,
          examTitle: latest.examTitle,
          subjectId: latest.subjectId ?? null,
          subjectName: latest.subjectName ?? latest.subject,
          maxAttempts: latest.maxAttempts,
          finalScore: latest.finalScore ?? null,
          resultStrategy: latest.resultStrategy ?? "highest",
          passingScore: latest.passingScore,
          resultVisibility: latest.resultVisibility ?? "hidden",
          gradingPending: ordered.some((attempt) => attempt.gradingPending),
          latestAttempt: latest,
          attempts: ordered,
        };
      })
      .sort((a, b) => attemptTime(b.latestAttempt) - attemptTime(a.latestAttempt));
  }, [results]);

  const subjectOptions = useMemo(
    () => Array.from(new Set(groups.map((group) => group.subjectName))).sort(),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const query = normalizeSearchText(searchQuery.trim());
    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        normalizeSearchText(group.examTitle).includes(query) ||
        normalizeSearchText(group.subjectName).includes(query);
      const matchesStatus = statusFilter === "all" || groupStatus(group) === statusFilter;
      const matchesSubject = subjectFilter === "all" || group.subjectName === subjectFilter;
      return matchesSearch && matchesStatus && matchesSubject;
    });
  }, [groups, searchQuery, statusFilter, subjectFilter]);

  const sortedGroups = useMemo(() => {
    if (sortBy === "date-desc") return filteredGroups;
    return [...filteredGroups].sort((a, b) => {
      const aScore = a.latestAttempt.scoreVisible ? a.finalScore : null;
      const bScore = b.latestAttempt.scoreVisible ? b.finalScore : null;
      if (aScore === null && bScore === null) return 0;
      if (aScore === null) return 1;
      if (bScore === null) return -1;
      return sortBy === "score-asc" ? aScore - bScore : bScore - aScore;
    });
  }, [filteredGroups, sortBy]);

  const selectedGroup = groups.find((group) => String(group.examId) === selectedExamId);

  const sortedAttempts = useMemo(() => {
    if (!selectedGroup) return [];
    if (attemptSortBy === "date-desc") return selectedGroup.attempts;
    return [...selectedGroup.attempts].sort((a, b) => {
      const aScore = a.scoreVisible ? a.attemptScore ?? null : null;
      const bScore = b.scoreVisible ? b.attemptScore ?? null : null;
      if (aScore === null && bScore === null) return 0;
      if (aScore === null) return 1;
      if (bScore === null) return -1;
      return attemptSortBy === "score-asc" ? aScore - bScore : bScore - aScore;
    });
  }, [selectedGroup, attemptSortBy]);

  if (loading) return <p className="text-gray-600">Loading exam results...</p>;
  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-6">
        {!selectedGroup && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search exams by title or subject..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">Status</p>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">Subject</p>
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {subjectOptions.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">Sort By</p>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger>
                      <ArrowUpDown className="mr-2 size-4 text-gray-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button variant="outline" onClick={() => setSelectedExamId(null)}>
                <ArrowLeft className="mr-2 size-4" />
                Back to Exams
              </Button>
              <Select value={attemptSortBy} onValueChange={(value) => setAttemptSortBy(value as SortOption)}>
                <SelectTrigger className="w-[200px]">
                  <ArrowUpDown className="mr-2 size-4 text-gray-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-white/70 p-4 shadow-sm">
              <span className="flex size-11 flex-shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <FileText className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedGroup.examTitle}</h2>
                <p className="text-sm text-slate-600">{selectedGroup.subjectName}</p>
              </div>
            </div>
            {sortedAttempts.map((attempt) => (
              <Card key={attempt.attemptId}>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      Attempt {attempt.attemptNumber ?? "-"}
                      {attempt.terminated ? " - Terminated" : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-4" />
                        {formatDate(attempt.submittedAt ?? attempt.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-4" />
                        {attempt.timeTaken}
                      </span>
                      {attempt.gradingPending ? <span className="text-amber-700">Grading in progress</span> : null}
                      {attempt.terminationReason ? (
                        <span className="text-orange-700">{attempt.terminationReason}</span>
                      ) : null}
                    </p>
                  </div>
                  {attempt.scoreVisible && attempt.attemptScore !== null ? (
                    <span className="font-medium text-teal-700">
                      {attempt.attemptScore.toFixed(2)} / {attempt.gradingScale}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">Score unavailable</span>
                  )}
                  {attempt.allowViewDetails ? (
                    <Button size="sm" onClick={() => onViewDetails(attempt.attemptId, attempt.examId)}>
                      <Eye className="mr-1 size-4" />
                      View Result
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map((group) => {
              const theme = GROUP_THEME[groupStatus(group)];
              const BadgeIcon = theme.badgeIcon;
              return (
                <Card key={group.examId} className={`${theme.card} hover:shadow-md`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex size-12 flex-shrink-0 self-start items-center justify-center rounded-xl ${theme.iconBg}`}>
                        <FileText className={`size-5 ${theme.iconText}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-xl text-slate-800">{group.examTitle}</h2>
                            <p className="text-sm text-slate-600">{group.subjectName}</p>
                          </div>
                          <Badge className={`${theme.badge} gap-1.5`}>
                            <BadgeIcon className="size-3.5" />
                            {theme.badgeLabel}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            <RefreshCw className="size-3.5 text-slate-500" />
                            Attempts: {group.attempts.length} /{" "}
                            {group.maxAttempts && group.maxAttempts > 0 ? group.maxAttempts : "Unlimited"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            <Clock className="size-3.5 text-slate-500" />
                            Latest #{group.latestAttempt.attemptNumber ?? "-"},{" "}
                            {formatDate(group.latestAttempt.submittedAt ?? group.latestAttempt.startedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                            <Award className="size-3.5 text-slate-500" />
                            {strategyLabel[group.resultStrategy]}
                          </span>
                        </div>
                        <div className={`mt-4 flex items-center justify-between rounded-lg border p-3 ${theme.scoreBox}`}>
                          {group.gradingPending ? (
                            <span className="text-amber-800">Grading in progress</span>
                          ) : group.latestAttempt.scoreVisible && group.finalScore !== null ? (
                            <span className={`text-lg font-semibold ${theme.scoreText}`}>
                              Final score: {group.finalScore.toFixed(2)} / {group.latestAttempt.gradingScale}
                            </span>
                          ) : (
                            <span className="text-slate-600">Final score not available</span>
                          )}
                          <Button variant="outline" onClick={() => setSelectedExamId(String(group.examId))}>
                            View Attempts
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {sortedGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-slate-600">
                  {groups.length === 0
                    ? "You do not have any exam results yet."
                    : "No exams found matching your search or filters."}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
      <ExamResultsStats groups={groups} />
    </div>
  );
}
