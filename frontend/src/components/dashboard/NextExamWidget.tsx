import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { StudentExamListItem } from "../../services/student-exam.service";
import { getCountdownParts } from "../../utils/student-exam-dashboard";

interface NextExamWidgetProps {
  exams: StudentExamListItem[];
  serverTime: string | null;
  onCountdownElapsed: () => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function NextExamWidget({ exams, serverTime, onCountdownElapsed }: NextExamWidgetProps) {
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
      <Card className="w-full min-w-0 box-border shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-500 to-blue-600 text-white">
        <CardContent className="py-8 text-center">No upcoming exams</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full min-w-0 box-border overflow-hidden shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-500 to-blue-600 text-white">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg flex items-center gap-2"><Clock className="size-5" />Next Exams</CardTitle>
      </CardHeader>
      <CardContent className="w-full min-w-0 box-border max-h-[360px] space-y-3 overflow-x-hidden overflow-y-auto px-4 sm:px-6">
        {exams.map((exam) => {
          const target = exam.status === "open" ? exam.endTime : exam.startTime;
          const countdown = getCountdownParts(target, now);
          const labels = [
            [countdown.days, "Days"], [countdown.hours, "Hours"], [countdown.minutes, "Mins"], [countdown.seconds, "Secs"],
          ] as const;
          return (
            <div key={exam.id} className="w-full min-w-0 box-border rounded-lg bg-white/15 p-3">
              <p className="text-sm font-medium">{exam.title}</p>
              <p className="text-xs opacity-75">{exam.subject}</p>
              <p className="mt-3 text-sm font-medium">{exam.status === "open" ? "Open now" : "Starts in"}</p>
              {target ? (
                <div className="mt-2 grid w-full min-w-0 grid-cols-4 gap-2">
                  {labels.map(([value, label]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-white/20 p-2 text-center">
                      <p className="text-lg">{pad(value)}</p>
                      <p className="text-xs opacity-75">{label}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-xs opacity-75">Schedule time unavailable</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
