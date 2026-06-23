import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Calendar, Clock, BookOpen, Filter, ArrowUpDown, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ExamDetailsDialog } from "./ExamDetailsDialog";
import { ExamCodeDialog } from "./ExamCodeDialog";

const API_BASE_URL = "http://localhost:8000";

interface Exam {
  id: string;
  title: string;
  subject: string;
  start_time: string;
  end_time: string;
  duration: string;
  status: "upcoming" | "open" | "completed" | "closed";
  maxAttempts: number;
  attemptsUsed: number;
}

const statusConfig = {
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  },
  open: {
    label: "Open Now",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
  },
  completed: {
    label: "Completed",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  },
};

interface ExamListProps {
  onEnterExam?: (examId: string) => void;
  onViewResults?: (examId: string) => void;
}

export function ExamList({ onEnterExam, onViewResults }: ExamListProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_BASE_URL}/api/exams`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.message || "Failed to load exams");
        }

        const apiExams: Exam[] = (data.exams || []).map((exam: any) => ({
          id: String(exam.exam_id),
          title: exam.title,
          subject: exam.description ?? "General",
          start_time: exam.start_time,
          end_time: exam.end_time,
          duration: exam.duration_minutes ? `${exam.duration_minutes} min` : "90 min",
          status: exam.status as "upcoming" | "open" | "completed" | "closed",
          maxAttempts: Number(exam.max_attempt ?? 1),
          attemptsUsed: Number(exam.attempts_used ?? 0),
        }));

        setExams(apiExams);
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Error loading exams");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const filteredExams = exams.filter(
    (exam) => filterStatus === "all" || exam.status === filterStatus
  );

  const handleViewDetails = (exam: Exam) => {
    setSelectedExam(exam);
    setDetailsOpen(true);
  };

  const handleEnterExam = (examId: string) => {
    setDetailsOpen(false);
    onEnterExam?.(examId);
  };

  const handleRequestCode = (exam: Exam) => {
    setSelectedExam(exam);
    setDetailsOpen(false);
    setCodeOpen(true);
  };

  const handleCodeSubmit = async (code: string): Promise<boolean> => {
    if (!selectedExam) return false;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE_URL}/api/exams/${selectedExam.id}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ code }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return false;
      }

      localStorage.setItem(
        "current_exam_attempt",
        JSON.stringify({
          examId: selectedExam.id,
          attemptId: data.attempt_id,
          attemptNo: data.attempt_no,
          durationMinutes: data.duration_minutes,
        })
      );

      setCodeOpen(false);
      handleEnterExam(selectedExam.id);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  if (loading) {
    return <p className="text-gray-600">Loading exams...</p>;
  }

  if (loadError) {
    return <p className="text-red-600">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl text-gray-800">My Exams</h1>
          <p className="text-gray-600 mt-1">
            View and manage your examination schedule
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open Now</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <ArrowUpDown className="size-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="subject">By Subject</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredExams.map((exam) => {
          const reachedMaxAttempts =
            exam.maxAttempts > 0 && exam.attemptsUsed >= exam.maxAttempts;

          return (
            <Card
              key={exam.id}
              className="shadow-lg hover:shadow-xl transition-shadow rounded-2xl border-0"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-gray-800">
                      {exam.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <BookOpen className="size-3.5" />
                      {exam.subject}
                    </CardDescription>
                  </div>
                  <Badge className={statusConfig[exam.status].className}>
                    {statusConfig[exam.status].label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-teal-600" />
                    <span>
                      {exam.start_time
                        ? new Date(exam.start_time).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No date"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-teal-600" />
                    <span>
                      {exam.start_time
                        ? new Date(exam.start_time).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-teal-600" />
                    <span>Duration: {exam.duration}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <RefreshCw className="size-4 text-teal-600" />
                    <span>
                      Attempts: {exam.attemptsUsed}/{exam.maxAttempts}
                    </span>
                  </div>
                </div>

                {exam.status === "open" && (
                  reachedMaxAttempts ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => onViewResults?.(exam.id)}
                    >
                      View Results
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleViewDetails(exam)}
                      >
                        View Details
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg"
                        onClick={() => handleRequestCode(exam)}
                      >
                        Enter Exam
                      </Button>
                    </div>
                  )
                )}

                {exam.status === "upcoming" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewDetails(exam)}
                  >
                    View Details
                  </Button>
                )}

                {exam.status === "completed" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onViewResults?.(exam.id)}
                  >
                    View Results
                  </Button>
                )}

                {exam.status === "closed" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onViewResults?.(exam.id)}
                  >
                    View Results
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredExams.length === 0 && (
        <Card className="p-12 text-center rounded-2xl shadow-lg">
          <p className="text-gray-500">
            No exams found for the selected filter.
          </p>
        </Card>
      )}

      <ExamDetailsDialog
        exam={selectedExam}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEnterExam={() => selectedExam && handleEnterExam(selectedExam.id)}
        onRequestCode={() => selectedExam && handleRequestCode(selectedExam)}
      />

      <ExamCodeDialog
        exam={selectedExam}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onSubmit={handleCodeSubmit}
      />
    </div>
  );
}
