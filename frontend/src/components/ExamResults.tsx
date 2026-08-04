import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Eye, FileText, RefreshCw } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ExamResultsStats } from "./exam-results/ExamResultsStats";
import { studentResultService } from "../services/student-result.service";
import type { StudentExamResult, StudentResultStatus } from "../types/student-result";

interface ExamResultsProps {
  onViewDetails: (attemptId: string) => void;
}

const resultStatuses: StudentResultStatus[] = ["published", "pending", "hidden"];

function scoreRatio(result: StudentExamResult): number | null {
  if (!result.scoreVisible || result.score === null || result.gradingScale <= 0) return null;
  return result.score / result.gradingScale;
}

function scoreColor(result: StudentExamResult): string {
  const ratio = scoreRatio(result);
  if (ratio === null) return "text-gray-700";
  if (result.passingScore !== null && result.score !== null && result.score >= result.passingScore) {
    return "text-green-600";
  }
  return ratio >= 0.8 ? "text-blue-600" : "text-red-600";
}

function formatDate(date: string | null): string {
  if (!date) return "Date unavailable";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function ExamResults({ onViewDetails }: ExamResultsProps) {
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StudentResultStatus>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  const loadResults = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setResults(await studentResultService.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load exam results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadResults(); }, []);

  const subjects = useMemo(
    () => Array.from(new Set(results.map((result) => result.subject).filter(Boolean))).sort(),
    [results],
  );

  const filteredResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = results.filter((result) => (
      (!query || result.examTitle.toLowerCase().includes(query) || result.subject.toLowerCase().includes(query))
      && (statusFilter === "all" || result.status === statusFilter)
      && (subjectFilter === "all" || result.subject === subjectFilter)
    ));

    return filtered.sort((first, second) => {
      if (sortBy === "subject") return first.subject.localeCompare(second.subject);
      if (sortBy === "date-desc" || sortBy === "date-asc") {
        const firstDate = first.date ? new Date(first.date).getTime() : 0;
        const secondDate = second.date ? new Date(second.date).getTime() : 0;
        return sortBy === "date-desc" ? secondDate - firstDate : firstDate - secondDate;
      }
      const firstRatio = scoreRatio(first);
      const secondRatio = scoreRatio(second);
      if (firstRatio === null && secondRatio === null) return 0;
      if (firstRatio === null) return 1;
      if (secondRatio === null) return -1;
      return sortBy === "score-desc" ? secondRatio - firstRatio : firstRatio - secondRatio;
    });
  }, [results, searchQuery, statusFilter, subjectFilter, sortBy]);

  if (loading) return <p className="text-gray-600">Loading exam results...</p>;
  if (loadError) {
    return (
      <Card><CardContent className="py-12 text-center space-y-4">
        <p className="text-red-600">{loadError}</p>
        <Button onClick={() => void loadResults()} variant="outline"><RefreshCw className="size-4 mr-2" />Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-6">
        <div><h1 className="text-3xl text-gray-800 mb-2">Exam Results</h1><p className="text-gray-600">View your exam scores and performance</p></div>
        <Card><CardContent className="pt-6 space-y-4">
          <div className="relative"><FileText className="absolute left-3 top-3 size-4 text-gray-400" /><Input placeholder="Search exams by title or subject..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-10" /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | StudentResultStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{resultStatuses.map((status) => <SelectItem key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</SelectItem>)}</SelectContent></Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent></Select>
            <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date-desc">Date (Newest)</SelectItem><SelectItem value="date-asc">Date (Oldest)</SelectItem><SelectItem value="score-desc">Score (Highest)</SelectItem><SelectItem value="score-asc">Score (Lowest)</SelectItem><SelectItem value="subject">Subject (A-Z)</SelectItem></SelectContent></Select>
          </div>
        </CardContent></Card>
        <div className="space-y-4">
          {filteredResults.map((result) => (
            <Card key={result.id} className="hover:shadow-lg transition-shadow"><CardContent className="p-6"><div className="flex items-start gap-4">
              <div className="p-2 bg-teal-100 rounded-lg mt-1"><FileText className="size-5 text-teal-600" /></div>
              <div className="flex-1 min-w-0"><div className="mb-2"><h3 className="text-xl text-gray-800 mb-1">{result.examTitle}</h3><p className="text-gray-600">{result.subject}</p></div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3"><span className="flex items-center gap-1"><Calendar className="size-4" />{formatDate(result.date)}</span><span className="flex items-center gap-1"><Clock className="size-4" />{result.duration}</span>{(result.maxAttempts ?? 0) > 0 && <span className="flex items-center gap-1"><RefreshCw className="size-4" />Attempt: {result.attemptNumber ?? 0}/{result.maxAttempts}</span>}</div>
                {result.status === "published" && result.scoreVisible && result.score !== null ? <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-4"><div className="flex items-center justify-between"><span className="text-sm text-gray-600">Your Score</span><span className={`text-2xl ${scoreColor(result)}`}>{result.score.toFixed(2)} / 10</span></div><div className="flex items-center justify-between text-sm text-gray-600 mt-2"><span>{result.correctAnswers !== null ? `${result.correctAnswers} / ${result.totalQuestions} correct answers` : ""}</span><span>Time: {result.timeTaken}</span></div></div> : null}
                {result.status === "pending" && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">Awaiting essay grading</div>}
                {result.status === "hidden" && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">Result is hidden by Teacher</div>}
                {result.status === "published" && !result.scoreVisible && <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">Result is hidden by Teacher</div>}
              </div>
              <div className="flex flex-col gap-2 shrink-0 w-32"><div className={`w-full h-9 flex items-center justify-center rounded-md border ${result.terminated ? "bg-orange-100 text-orange-700 border-orange-200" : result.status === "published" ? "bg-green-100 text-green-700 border-green-200" : result.status === "pending" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200"}`}>{result.terminated ? "Terminated" : result.status[0].toUpperCase() + result.status.slice(1)}</div>{result.allowViewDetails && <Button onClick={() => onViewDetails(String(result.attemptId))} className="w-full bg-gradient-to-r from-teal-500 to-blue-600" size="sm"><Eye className="size-4 mr-1" />View</Button>}</div>
            </div></CardContent></Card>
          ))}
          {filteredResults.length === 0 && <Card><CardContent className="py-12 text-center text-gray-600">{results.length === 0 ? "You do not have any exam results yet." : "No exam results found matching your criteria."}</CardContent></Card>}
        </div>
      </div>
      <ExamResultsStats results={results} />
    </div>
  );
}
