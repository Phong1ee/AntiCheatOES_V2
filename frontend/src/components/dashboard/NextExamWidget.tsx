import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { StudentExamListItem } from "../../services/student-exam.service";
import { getCountdownParts } from "../../utils/student-exam-dashboard";

interface NextExamWidgetProps {
  exams: StudentExamListItem[];
  serverTime: string | null;
  onCountdownElapsed: () => void;
  onRequestExamAccess: (exam: StudentExamListItem) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function NextExamWidget({ exams, serverTime, onCountdownElapsed, onRequestExamAccess }: NextExamWidgetProps) {
  const serverOffset = useRef(0);
  const elapsedTargets = useRef(new Set<string>());
  const refreshRequested = useRef(false);
  const [now, setNow] = useState(() => new Date(serverTime ?? Date.now()));

  useEffect(() => {
    serverOffset.current = serverTime ? new Date(serverTime).getTime() - Date.now() : 0;
    elapsedTargets.current.clear();
    refreshRequested.current = false;
    setNow(new Date(Date.now() + serverOffset.current));

    const interval = window.setInterval(() => {
      setNow(new Date(Date.now() + serverOffset.current));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [serverTime]);

  useEffect(() => {
    const elapsedExam = exams.find((exam) => {
      const target = exam.status === "open" ? exam.endTime : exam.startTime;
      return target && getCountdownParts(target, now).remainingSeconds === 0 && !elapsedTargets.current.has(`${exam.id}:${target}`);
    });
    if (elapsedExam && !refreshRequested.current) {
      const target = elapsedExam.status === "open" ? elapsedExam.endTime : elapsedExam.startTime;
      elapsedTargets.current.add(`${elapsedExam.id}:${target}`);
      refreshRequested.current = true;
      onCountdownElapsed();
    }
  }, [exams, now, onCountdownElapsed]);

  if (exams.length === 0) {
    return (
      <Card className="w-full min-w-0 box-border rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="py-8 text-center text-slate-500">No upcoming exams</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full min-w-0 box-border overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-800"><span className="flex size-9 items-center justify-center rounded-xl bg-teal-50"><Clock className="size-5 text-teal-700" /></span>Next Exams</CardTitle>
      </CardHeader>
      <CardContent className="w-full min-w-0 box-border max-h-[420px] space-y-3 overflow-x-hidden overflow-y-auto px-5 py-4 sm:px-6">
        {exams.map((exam) => {
          const target = exam.status === "open" ? exam.endTime : exam.startTime;
          const countdown = getCountdownParts(target, now);
          const labels = [
            [countdown.days, "Days"], [countdown.hours, "Hours"], [countdown.minutes, "Mins"], [countdown.seconds, "Secs"],
          ] as const;
          return (
            <div key={exam.id} {...(exam.status === "open" ? { role: "button", tabIndex: 0, onClick: () => onRequestExamAccess(exam), onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRequestExamAccess(exam); } } } : {})} className={`w-full min-w-0 box-border rounded-xl border border-slate-200 bg-slate-50 p-4 ${exam.status === "open" ? "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2" : ""}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{exam.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{exam.subject}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${exam.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{exam.status === "open" ? "Open now" : "Upcoming"}</span></div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">{exam.status === "open" ? "Time remaining" : "Starts in"}</p>
              {target ? (
                <div className="mt-2 grid w-full min-w-0 grid-cols-4 gap-2">
                  {labels.map(([value, label]) => (
                    <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-center">
                      <p className="text-lg font-semibold text-slate-800">{pad(value)}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-xs text-slate-500">Schedule time unavailable</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
