import type { StudentExamListItem } from "../services/student-exam.service";

const timestamp = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export function selectNearestExam(
  exams: StudentExamListItem[],
  serverNow: Date,
): StudentExamListItem | null {
  const now = serverNow.getTime();
  const openExams = exams
    .filter((exam) => exam.status === "open")
    .filter((exam) => {
      const endTime = timestamp(exam.endTime);
      return endTime === null || endTime > now;
    })
    .sort((first, second) => (timestamp(first.endTime) ?? Number.POSITIVE_INFINITY) - (timestamp(second.endTime) ?? Number.POSITIVE_INFINITY));

  if (openExams[0]) return openExams[0];

  return exams
    .filter((exam) => exam.status === "upcoming")
    .filter((exam) => {
      const startTime = timestamp(exam.startTime);
      return startTime !== null && startTime > now;
    })
    .sort((first, second) => (timestamp(first.startTime) ?? Number.POSITIVE_INFINITY) - (timestamp(second.startTime) ?? Number.POSITIVE_INFINITY))[0] ?? null;
}

export function selectActiveAndUpcomingExams(
  exams: StudentExamListItem[],
  serverNow: Date,
): StudentExamListItem[] {
  const now = serverNow.getTime();
  const openExams = exams
    .filter((exam) => exam.status === "open")
    .filter((exam) => {
      const endTime = timestamp(exam.endTime);
      return endTime === null || endTime > now;
    })
    .sort((first, second) => (timestamp(first.endTime) ?? Number.POSITIVE_INFINITY) - (timestamp(second.endTime) ?? Number.POSITIVE_INFINITY));
  const upcomingExams = exams
    .filter((exam) => exam.status === "upcoming")
    .filter((exam) => {
      const startTime = timestamp(exam.startTime);
      return startTime !== null && startTime > now;
    })
    .sort((first, second) => (timestamp(first.startTime) ?? Number.POSITIVE_INFINITY) - (timestamp(second.startTime) ?? Number.POSITIVE_INFINITY));

  return [...openExams, ...upcomingExams];
}

export function getCountdownParts(target: string | undefined, now: Date) {
  const targetTime = timestamp(target);
  const remainingSeconds = targetTime === null ? 0 : Math.max(0, Math.floor((targetTime - now.getTime()) / 1000));
  return {
    days: Math.floor(remainingSeconds / 86400),
    hours: Math.floor((remainingSeconds % 86400) / 3600),
    minutes: Math.floor((remainingSeconds % 3600) / 60),
    seconds: remainingSeconds % 60,
    remainingSeconds,
  };
}
