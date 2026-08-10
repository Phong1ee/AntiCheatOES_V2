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
import { PreExamSecurityDialog } from "./PreExamSecurityDialog";
import { studentExamService, type StudentExamListItem } from "../../services/student-exam.service";
import type { AntiCheatRuntime } from "../../anti-cheat/anti-cheat-runtime";

type Exam = StudentExamListItem;

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
  onEnterExam?: (examId: string, stream?: MediaStream, refreshViolationRecorded?: boolean, runtime?: AntiCheatRuntime) => void;
  onViewResults?: (examId: string) => void;
  exams?: StudentExamListItem[];
  loading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  autoOpenCodeExamId?: string | null;
}

export function ExamList({
  onEnterExam,
  onViewResults,
  exams: suppliedExams,
  loading: suppliedLoading,
  loadError: suppliedLoadError,
  onRetry,
  autoOpenCodeExamId,
}: ExamListProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityCode, setSecurityCode] = useState<string | undefined>();
  const [securityResume, setSecurityResume] = useState(false);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [fetchedExams, setFetchedExams] = useState<Exam[]>([]);
  const [fetchedLoading, setFetchedLoading] = useState(suppliedExams === undefined);
  const [fetchedLoadError, setFetchedLoadError] = useState<string | null>(null);

  const fetchExams = async () => {
      try {
        setFetchedLoading(true);
        setFetchedLoadError(null);

        setFetchedExams(await studentExamService.list());
      } catch (err) {
        console.error(err);
        setFetchedLoadError(err instanceof Error ? err.message : "Error loading exams");
      } finally {
        setFetchedLoading(false);
      }
    };

  useEffect(() => {
    if (suppliedExams === undefined) void fetchExams();
  }, [suppliedExams]);

  const exams = suppliedExams ?? fetchedExams;
  const loading = suppliedLoading ?? fetchedLoading;
  const loadError = suppliedLoadError ?? fetchedLoadError;

  const filteredExams = exams
    .filter((exam) => filterStatus === "all" || exam.status === filterStatus)
    .sort((first, second) => {
      if (sortBy === "subject") return first.subject.localeCompare(second.subject);
      if (sortBy === "status") return first.status.localeCompare(second.status);
      const firstDate = first.startTime ? new Date(first.startTime).getTime() : Number.POSITIVE_INFINITY;
      const secondDate = second.startTime ? new Date(second.startTime).getTime() : Number.POSITIVE_INFINITY;
      return firstDate - secondDate;
    });

  const handleViewDetails = (exam: Exam) => {
    setSelectedExam(exam);
    setDetailsOpen(true);
  };

  const handleEnterExam = (examId: string) => {
    setDetailsOpen(false);
    onEnterExam?.(examId);
  };

  const startExam = async (exam: Exam, code?: string, stream?: MediaStream, runtime?: AntiCheatRuntime) => {
    setStartingExamId(exam.id);
    try {
      const data = await studentExamService.start(exam.id, code);
      localStorage.setItem(
        "current_exam_attempt",
        JSON.stringify({
          examId: exam.id,
          attemptId: data.attemptId,
          attemptNo: data.attemptNo,
          durationMinutes: data.durationMinutes,
        })
      );
      setCodeOpen(false);
      onEnterExam?.(exam.id, stream, false, runtime);
    } finally {
      setStartingExamId(null);
    }
  };

  const handleRequestCode = (exam: Exam) => {
    setSelectedExam(exam);
    setDetailsOpen(false);
    if (!exam.requiresExamCode && !exam.antiCheatEnabled) {
      setFetchedLoadError(null);
      void startExam(exam).catch((error: unknown) => {
        console.error(error);
        setFetchedLoadError(error instanceof Error ? error.message : "Unable to start the exam.");
      });
    } else if (exam.antiCheatEnabled && !exam.requiresExamCode) {
      setSecurityCode(undefined); setSecurityResume(false); setSecurityOpen(true);
    } else {
      setCodeOpen(true);
    }
  };
  useEffect(() => {
    const exam = exams.find((item) => item.id === autoOpenCodeExamId && item.status === "open");
    if (exam) handleRequestCode(exam);
  }, [autoOpenCodeExamId, exams]);

  const handleCodeVerify = async (code: string) => {
    if (!selectedExam) throw new Error("No exam selected");
    return studentExamService.verifyCode(selectedExam.id, code);
  };

  const handleCodeStart = async (code: string) => {
    if (!selectedExam) throw new Error("No exam selected");
    try {
      if (selectedExam.antiCheatEnabled) {
        setSecurityCode(code || undefined); setSecurityResume(false); setCodeOpen(false); setSecurityOpen(true);
      } else await startExam(selectedExam, code || undefined);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleResume = async (exam: Exam) => {
    if (!exam.openAttemptId) return;
    setFetchedLoadError(null);
    if (exam.antiCheatEnabled) {
      setSelectedExam(exam); setSecurityCode(undefined); setSecurityResume(true); setSecurityOpen(true);
      return;
    }
    try {
      const resumed = await studentExamService.resume(exam.id, exam.openAttemptId, "normal_resume");
      if (Boolean(resumed.terminated)) {
        setFetchedLoadError("This attempt has already ended and cannot be resumed.");
        return;
      }
      localStorage.setItem("current_exam_attempt", JSON.stringify({ examId: exam.id, attemptId: exam.openAttemptId }));
      onEnterExam?.(exam.id);
    } catch (error) {
      setFetchedLoadError(error instanceof Error ? error.message : "Unable to resume this exam.");
    }
  };

  const handleSecurityReady = async (stream: MediaStream, runtime: AntiCheatRuntime) => {
    if (!selectedExam) throw new Error("No exam selected");
    if (securityResume) {
      if (!selectedExam.openAttemptId) throw new Error("No open attempt is available to resume.");
      const resumed = await studentExamService.resume(selectedExam.id, selectedExam.openAttemptId, "normal_resume");
      if (Boolean(resumed.terminated)) throw new Error("This attempt has already ended and received 0 points.");
      localStorage.setItem("current_exam_attempt", JSON.stringify({ examId: selectedExam.id, attemptId: selectedExam.openAttemptId }));
      onEnterExam?.(selectedExam.id, stream, resumed.refreshViolationRecorded, runtime);
      return;
    }
    await startExam(selectedExam, securityCode, stream, runtime);
  };

  if (loading) {
    return <p className="text-gray-600">Loading exams...</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-red-600">{loadError}</p>
        <Button variant="outline" onClick={onRetry ?? fetchExams}>Retry</Button>
      </div>
    );
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
            exam.maxAttempts !== null && exam.maxAttempts > 0 && exam.attemptsUsed >= exam.maxAttempts;

          return (
            <Card
              key={exam.id}
              className="rounded-2xl border border-gray-200 shadow-lg transition-shadow hover:shadow-xl"
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
                      {exam.startTime
                        ? new Date(exam.startTime).toLocaleDateString("en-US", {
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
                      {exam.startTime
                        ? new Date(exam.startTime).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-teal-600" />
                    <span>Duration: {exam.durationMinutes} min</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <RefreshCw className="size-4 text-teal-600" />
                    <span>
                      Attempts: {exam.attemptsUsed}/{exam.maxAttempts ? exam.maxAttempts : "Unlimited"}
                    </span>
                  </div>
                </div>

                {exam.status === "open" && (
                  exam.canResume ? (
                    <Button className="w-full bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => handleResume(exam)}>
                      Resume Exam
                    </Button>
                  ) : reachedMaxAttempts ? (
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
                        disabled={startingExamId === exam.id}
                      >
                        {startingExamId === exam.id ? "Starting..." : "Enter Exam"}
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
        onEnterExam={() => selectedExam && handleRequestCode(selectedExam)}
        onRequestCode={() => selectedExam && handleRequestCode(selectedExam)}
      />

      <ExamCodeDialog
        exam={selectedExam}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onVerify={handleCodeVerify}
        onStart={handleCodeStart}
      />
      {selectedExam && <PreExamSecurityDialog
        open={securityOpen}
        examTitle={selectedExam.title}
        violationLimit={selectedExam.violationLimit}
        onOpenChange={setSecurityOpen}
        onReady={handleSecurityReady}
      />}
    </div>
  );
}
