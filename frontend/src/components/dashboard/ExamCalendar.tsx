import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, List, LoaderCircle, RotateCcw } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import type { StudentExamListItem } from "../../services/student-exam.service";

type CalendarView = "month" | "week" | "agenda";

interface ExamCalendarProps {
  exams: StudentExamListItem[];
  loading: boolean;
  loadError: string | null;
  serverTime: string | null;
  onRetry: () => void;
  onOpenExam: (exam: StudentExamListItem) => void;
  onViewResults: (examId: string) => void;
}

const statusStyle = {
  upcoming: "border-blue-200 bg-blue-50 text-blue-700",
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-slate-200 bg-slate-100 text-slate-600",
  closed: "border-slate-200 bg-slate-100 text-slate-600",
};

const statusLabel = {
  upcoming: "Upcoming",
  open: "Open now",
  completed: "Completed",
  closed: "Closed",
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const sameDay = (first: Date, second: Date) => first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
const parseDate = (value?: string) => value ? new Date(value) : null;
const formatTime = (value?: string) => {
  const date = parseDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "Time unavailable";
};
const formatDateTime = (value?: string) => {
  const date = parseDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Not scheduled";
};

function examOccursOn(exam: StudentExamListItem, day: Date) {
  const start = parseDate(exam.startTime);
  if (!start || Number.isNaN(start.getTime())) return false;
  const end = parseDate(exam.endTime) ?? start;
  // An exam is a scheduled event, not an all-day activity during its availability window.
  return sameDay(start, day) || sameDay(end, day);
}

function occurrenceLabel(exam: StudentExamListItem, day: Date) {
  const startsToday = sameDay(parseDate(exam.startTime) ?? day, day);
  const endsToday = sameDay(parseDate(exam.endTime) ?? parseDate(exam.startTime) ?? day, day);
  if (startsToday && endsToday) return `Starts ${formatTime(exam.startTime)} - ends ${formatTime(exam.endTime)}`;
  return startsToday ? `Starts at ${formatTime(exam.startTime)}` : `Ends at ${formatTime(exam.endTime)}`;
}

function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstMondayOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => addDays(first, index - firstMondayOffset));
}

function EventChip({ exam, day, onSelect }: { exam: StudentExamListItem; day: Date; onSelect: (exam: StudentExamListItem) => void }) {
  const occurrence = occurrenceLabel(exam, day);
  return <button onClick={() => onSelect(exam)} className={`block w-full truncate rounded-md border px-2 py-1 text-left text-xs font-medium transition hover:brightness-95 ${statusStyle[exam.status]}`} title={exam.title}>
    <span className="font-semibold">{occurrence}:</span> {exam.title}
  </button>;
}

export function ExamCalendar({ exams, loading, loadError, serverTime, onRetry, onOpenExam, onViewResults }: ExamCalendarProps) {
  const serverNow = parseDate(serverTime ?? undefined);
  const today = startOfDay(serverNow && !Number.isNaN(serverNow.getTime()) ? serverNow : new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedExam, setSelectedExam] = useState<StudentExamListItem | null>(null);
  const gridDays = useMemo(() => monthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => {
    const offset = (cursor.getDay() + 6) % 7;
    const monday = addDays(cursor, -offset);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [cursor]);
  const selectedDayExams = useMemo(() => exams.filter((exam) => examOccursOn(exam, selectedDay)), [exams, selectedDay]);
  const agendaExams = useMemo(() => [...exams]
    .filter((exam) => {
      const start = parseDate(exam.startTime);
      return start && !Number.isNaN(start.getTime()) && start.getMonth() === cursor.getMonth() && start.getFullYear() === cursor.getFullYear();
    })
    .sort((first, second) => (parseDate(first.startTime)?.getTime() ?? 0) - (parseDate(second.startTime)?.getTime() ?? 0)), [exams, cursor]);

  const move = (amount: number) => {
    const next = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1) : addDays(cursor, amount * 7);
    setCursor(next);
    setSelectedDay(next);
  };
  const goToToday = () => { setCursor(today); setSelectedDay(today); };
  const monthTitle = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekTitle = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  if (loading) return <div className="flex min-h-72 items-center justify-center text-slate-600"><LoaderCircle className="mr-2 size-5 animate-spin" />Loading your exam schedule...</div>;
  if (loadError) return <Card className="rounded-2xl border-red-100"><CardContent className="p-8 text-center"><p className="text-red-600">{loadError}</p><Button variant="outline" className="mt-4" onClick={onRetry}>Retry</Button></CardContent></Card>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><span className="flex size-10 items-center justify-center rounded-xl bg-teal-50"><CalendarDays className="size-5 text-teal-700" /></span><h1 className="text-2xl font-semibold text-slate-900">Exam Calendar</h1></div><p className="mt-2 text-sm text-slate-600">Plan your schedule and open an exam when it becomes available.</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{(["month", "week", "agenda"] as CalendarView[]).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${view === item ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{item}</button>)}</div><Button variant="outline" size="sm" onClick={goToToday}>Today</Button></div>
    </div>

    <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6"><Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Previous period"><ChevronLeft className="size-5" /></Button><h2 className="font-semibold text-slate-800">{view === "month" ? monthTitle : view === "week" ? weekTitle : `Agenda - ${monthTitle}`}</h2><Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Next period"><ChevronRight className="size-5" /></Button></div>
      {view === "month" && <div className="overflow-x-auto"><div className="min-w-[700px]"><div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>)}</div><div className="grid grid-cols-7">{gridDays.map((day) => { const dayExams = exams.filter((exam) => examOccursOn(exam, day)); const currentMonth = day.getMonth() === cursor.getMonth(); const selectDay = () => setSelectedDay(day); return <div key={day.toISOString()} role="button" tabIndex={0} onClick={selectDay} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDay(); } }} aria-label={`Select ${day.toLocaleDateString("en-US")}`} className={`min-h-28 cursor-pointer border-b border-r border-slate-100 p-2 text-left transition hover:bg-teal-50/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${!currentMonth ? "bg-slate-50/70 text-slate-400" : "bg-white"} ${sameDay(day, selectedDay) ? "ring-2 ring-inset ring-teal-500" : ""}`}><span className={`mb-2 flex size-6 items-center justify-center rounded-full text-xs font-medium ${sameDay(day, today) ? "bg-teal-600 text-white" : ""}`}>{day.getDate()}</span><div className="space-y-1">{dayExams.slice(0, 2).map((exam) => <EventChip key={`${day.toISOString()}-${exam.id}`} exam={exam} day={day} onSelect={setSelectedExam} />)}{dayExams.length > 2 && <p className="px-1 text-xs text-slate-500">+{dayExams.length - 2} more</p>}</div></div>; })}</div></div></div>}
      {view === "week" && <div className="overflow-x-auto"><div className="min-w-[700px]"><div className="grid grid-cols-7">{weekDays.map((day) => <div key={day.toISOString()} className={`min-h-80 border-r border-slate-100 p-3 ${sameDay(day, today) ? "bg-teal-50/40" : ""}`}><button onClick={() => setSelectedDay(day)} className={`mb-4 flex w-full flex-col rounded-lg p-2 text-left ${sameDay(day, selectedDay) ? "bg-teal-100" : "hover:bg-slate-50"}`}><span className="text-xs uppercase text-slate-500">{day.toLocaleDateString("en-US", { weekday: "short" })}</span><span className="text-lg font-semibold text-slate-800">{day.getDate()}</span></button><div className="space-y-2">{exams.filter((exam) => examOccursOn(exam, day)).map((exam) => <EventChip key={exam.id} exam={exam} day={day} onSelect={setSelectedExam} />)}</div></div>)}</div></div></div>}
      {view === "agenda" && <div className="divide-y divide-slate-100">{agendaExams.length === 0 ? <p className="p-10 text-center text-slate-500">No scheduled exams.</p> : agendaExams.map((exam) => <button key={exam.id} onClick={() => setSelectedExam(exam)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-teal-50/50 sm:px-6"><div className="w-20 shrink-0 text-center"><p className="text-xs uppercase tracking-wide text-slate-500">{parseDate(exam.startTime)?.toLocaleDateString("en-US", { month: "short" })}</p><p className="text-2xl font-semibold text-slate-800">{parseDate(exam.startTime)?.getDate()}</p></div><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-800">{exam.title}</p><p className="mt-1 text-sm text-slate-500">{exam.subject} - {formatTime(exam.startTime)}</p></div><Badge className={statusStyle[exam.status]}>{statusLabel[exam.status]}</Badge></button>)}</div>}
    </CardContent></Card>

    <Card className="rounded-2xl border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-800">{selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2><p className="mt-1 text-sm text-slate-500">{selectedDayExams.length ? `${selectedDayExams.length} exam${selectedDayExams.length === 1 ? "" : "s"} scheduled` : "No exams scheduled"}</p></div><List className="size-5 text-slate-400" /></div>{selectedDayExams.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedDayExams.map((exam) => <button key={exam.id} onClick={() => setSelectedExam(exam)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/50"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 font-medium text-slate-800">{exam.title}</p><Badge className={statusStyle[exam.status]}>{statusLabel[exam.status]}</Badge></div><p className="mt-2 text-sm font-medium text-teal-700">{occurrenceLabel(exam, selectedDay)}</p><p className="mt-1 text-sm text-slate-500">{exam.subject}</p></button>)}</div>}</CardContent></Card>

    <Sheet open={Boolean(selectedExam)} onOpenChange={(open) => !open && setSelectedExam(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><SheetHeader><div className="flex items-start gap-3 pr-8"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50"><CalendarDays className="size-5 text-teal-700" /></span><div><SheetTitle>{selectedExam?.title}</SheetTitle><SheetDescription className="mt-1">{selectedExam?.subject}</SheetDescription></div></div></SheetHeader>{selectedExam && <div className="space-y-6 px-4 pb-6"><Badge className={statusStyle[selectedExam.status]}>{statusLabel[selectedExam.status]}</Badge><div className="space-y-4 rounded-xl bg-slate-50 p-4 text-sm"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Starts</p><p className="mt-1 text-slate-800">{formatDateTime(selectedExam.startTime)}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ends</p><p className="mt-1 text-slate-800">{formatDateTime(selectedExam.endTime)}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</p><p className="mt-1 text-slate-800">{selectedExam.durationMinutes} minutes</p></div></div>{selectedExam.antiCheatEnabled && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This exam uses live anti-cheat monitoring. Camera, microphone, and fullscreen checks are required before starting.</p>}{selectedExam.status === "open" ? <Button className="w-full bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => { onOpenExam(selectedExam); setSelectedExam(null); }}><ExternalLink className="mr-2 size-4" />{selectedExam.canResume ? "Resume exam" : "Enter exam"}</Button> : (selectedExam.status === "completed" || selectedExam.status === "closed") ? <Button variant="outline" className="w-full" onClick={() => { onViewResults(selectedExam.id); setSelectedExam(null); }}>View results</Button> : <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">This exam becomes available at its scheduled start time.</p>}</div>}</SheetContent></Sheet>
  </div>;
}
