import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Search,
  Calendar,
  Clock,
  Eye,
  FileText,
  RefreshCw,
} from "lucide-react";
import { ExamResultsStats } from "./exam-results/ExamResultsStats";

const API_BASE_URL = "http://localhost:5000";

interface ExamResult {
  id: string;
  examTitle: string;
  subject: string;
  date: string;
  duration: string;
  status: "published" | "pending" | "hidden";
  score?: number; // BE hiện đang trả: số câu đúng (raw) -> KHÔNG dùng trực tiếp để hiển thị %
  correctAnswers?: number; // số câu đúng
  totalQuestions?: number; // tổng số câu
  timeTaken?: string;
  scoreVisible: boolean;
  allowViewDetails: boolean;
  attemptNumber?: number;
  maxAttempts?: number;
}

interface ExamResultsProps {
  onViewDetails: (examId: string) => void;
}

export function ExamResults({ onViewDetails }: ExamResultsProps) {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // ===== helpers: tính % từ correct/total =====
  const getPercent = (exam: ExamResult): number | undefined => {
    const correct = exam.correctAnswers ?? exam.score; // fallback sang score raw nếu BE chưa map
    const total = exam.totalQuestions;
    if (correct === undefined || !total || total <= 0) return undefined;
    return Math.min(100, Math.max(0, Math.round((correct / total) * 100)));
  };

  const getScoreColor = (percent: number) => {
    if (percent >= 90) return "text-green-600";
    if (percent >= 80) return "text-blue-600";
    if (percent >= 70) return "text-teal-600";
    if (percent >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Fetch từ backend
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_BASE_URL}/api/results`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load results");
        }

        const data = await res.json();
        setResults(data.results || []);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Error loading results");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  const subjects = Array.from(
    new Set(results.map((e) => e.subject).filter(Boolean))
  );

  // Filter
  let filteredExams = results.filter((exam) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      exam.examTitle.toLowerCase().includes(q) ||
      exam.subject.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || exam.status === (statusFilter as any);
    const matchesSubject =
      subjectFilter === "all" || exam.subject === subjectFilter;
    return matchesSearch && matchesStatus && matchesSubject;
  });

  // ===== Sort (dùng % đã tính, KHÔNG dùng exam.score raw) =====
  filteredExams.sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case "date-asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "score-desc": {
        const pa = getPercent(a) ?? -1;
        const pb = getPercent(b) ?? -1;
        return pb - pa;
      }
      case "score-asc": {
        const pa = getPercent(a) ?? 101;
        const pb = getPercent(b) ?? 101;
        return pa - pb;
      }
      case "subject":
        return a.subject.localeCompare(b.subject);
      default:
        return 0;
    }
  });

  if (loading) return <p className="text-gray-600">Loading exam results...</p>;
  if (loadError) return <p className="text-red-600">{loadError}</p>;

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl text-gray-800 mb-2">Exam Results</h1>
          <p className="text-gray-600">View your exam scores and performance</p>
        </div>

        {/* Filters & Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-gray-400" />
                <Input
                  placeholder="Search exams by title or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-600 mb-2 block">
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-2 block">
                    Subject
                  </label>
                  <Select
                    value={subjectFilter}
                    onValueChange={setSubjectFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-2 block">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Date (Newest)</SelectItem>
                      <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                      <SelectItem value="score-desc">
                        Score (Highest %)
                      </SelectItem>
                      <SelectItem value="score-asc">
                        Score (Lowest %)
                      </SelectItem>
                      <SelectItem value="subject">Subject (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results list */}
        <div className="space-y-4">
          {filteredExams.map((exam) => {
            const percent = getPercent(exam);

            return (
              <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-teal-100 rounded-lg mt-1">
                      <FileText className="size-5 text-teal-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <h3 className="text-xl text-gray-800 mb-1">
                          {exam.examTitle}
                        </h3>
                        <p className="text-gray-600">{exam.subject}</p>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-4" />
                          {new Date(exam.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="size-4" />
                          {exam.duration}
                        </span>

                        {/* ✅ Attempt nằm bên phải icon Clock */}
                        {Number(exam.maxAttempts) > 0 && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="size-4" />
                            Attempt: {exam.attemptNumber ?? 0}/
                            {exam.maxAttempts}
                          </span>
                        )}
                      </div>

                      {/* Score & messages */}
                      {exam.status === "published" &&
                        exam.scoreVisible &&
                        percent !== undefined && (
                          <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">
                                Your Score
                              </span>
                              <span
                                className={`text-2xl ${getScoreColor(percent)}`}
                              >
                                {percent}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>
                                {exam.correctAnswers ?? exam.score}/
                                {exam.totalQuestions} correct
                              </span>
                              <span>Time: {exam.timeTaken}</span>
                            </div>
                          </div>
                        )}

                      {exam.status === "published" && !exam.scoreVisible && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            🔒 Score hidden by instructor. You will be notified
                            when it becomes available.
                          </p>
                        </div>
                      )}

                      {exam.status === "pending" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800">
                            ⏳ Results will be published after grading is
                            completed.
                          </p>
                        </div>
                      )}

                      {exam.status === "hidden" && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-800">
                            🔒 This exam result is currently not available for
                            viewing.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Status + action */}
                    <div className="flex flex-col gap-2 shrink-0 w-32">
                      <div className="w-full">
                        {exam.status === "published" ? (
                          <div className="w-full h-9 flex items-center justify-center bg-green-100 text-green-700 rounded-md border border-green-200">
                            🟢 Published
                          </div>
                        ) : exam.status === "pending" ? (
                          <div className="w-full h-9 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded-md border border-yellow-200">
                            🟡 Pending
                          </div>
                        ) : (
                          <div className="w-full h-9 flex items-center justify-center bg-red-100 text-red-700 rounded-md border border-red-200">
                            🔴 Hidden
                          </div>
                        )}
                      </div>
                      <div className="w-full">
                        {exam.allowViewDetails &&
                        exam.status === "published" ? (
                          <Button
                            onClick={() => onViewDetails(exam.id)}
                            className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
                            size="sm"
                          >
                            <Eye className="size-4 mr-1" />
                            View
                          </Button>
                        ) : exam.status === "published" ? (
                          <Button
                            variant="outline"
                            disabled
                            className="w-full"
                            size="sm"
                          >
                            <Eye className="size-4 mr-1" />
                            N/A
                          </Button>
                        ) : (
                          <div className="h-9" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredExams.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">
                  No exam results found matching your criteria.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sidebar stats: nếu component này hiển thị % thì hãy truyền percent vào đó theo cùng cách */}
      <ExamResultsStats results={results} />
    </div>
  );
}
