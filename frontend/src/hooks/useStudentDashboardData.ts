import { useCallback, useEffect, useState } from "react";
import { studentExamService, type StudentExamListItem } from "../services/student-exam.service";
import { studentResultService } from "../services/student-result.service";
import type { StudentExamResult } from "../types/student-result";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useStudentDashboardData() {
  const [exams, setExams] = useState<StudentExamListItem[]>([]);
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  const load = useCallback(async () => {
    setExamsLoading(true);
    setResultsLoading(true);
    setExamsError(null);
    setResultsError(null);

    const [examsResponse, resultsResponse] = await Promise.allSettled([
      studentExamService.listWithMeta(),
      studentResultService.list(),
    ]);

    if (examsResponse.status === "fulfilled") {
      setExams(examsResponse.value.exams);
      setServerTime(examsResponse.value.serverTime);
    } else {
      setExamsError(errorMessage(examsResponse.reason, "Unable to load exams."));
    }

    if (resultsResponse.status === "fulfilled") {
      setResults(resultsResponse.value);
    } else {
      setResultsError(errorMessage(resultsResponse.reason, "Unable to load results."));
    }

    setExamsLoading(false);
    setResultsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { exams, results, serverTime, examsLoading, resultsLoading, examsError, resultsError, retry: load };
}
