import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExamEditor } from "./ExamEditor";
import { ExamListSidebar } from "./ExamListSidebar";
import { teacherExamService } from "../../../services/teacher-exam.service";
import type { ExamStatus, TeacherExamApi, TeacherSubject } from "../../../types/teacher-exam";

interface Exam {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  class: string;
  status: ExamStatus;
  startTime: string;
  endTime: string;
  date: string;
  questionCount: number;
  assignedStudents: number;
  averageScore: number | null;
  duration?: number;
  examCode?: string;
  description?: string;
  maxAttempt: number;
  totalPoints: number;
  passingScore: number;
}

const toManagerExam = (exam: TeacherExamApi, subjects: TeacherSubject[]): Exam => ({
  id: String(exam.exam_id),
  title: exam.title,
  subject: exam.subject ?? "No subject",
  subjectId: exam.subject_id ?? subjects.find((subject) => subject.subject_name === exam.subject)?.subject_id ?? "",
  class: "Unassigned",
  status: exam.status,
  startTime: exam.start_time ?? "",
  endTime: exam.end_time ?? "",
  date: exam.start_time ?? new Date().toISOString(),
  questionCount: 0,
  assignedStudents: exam.totalStudents,
  averageScore: null,
  duration: exam.duration_minutes ?? 0,
  examCode: exam.examcode,
  description: exam.description ?? "",
  maxAttempt: exam.max_attempt ?? 1,
  totalPoints: exam.total_points,
  passingScore: exam.passing_score,
});

interface ExamManagerPageProps {
  initialExamId?: string | null;
}

export function ExamManagerPage({ initialExamId }: ExamManagerPageProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(initialExamId ?? null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadManagerData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [apiExams, apiSubjects] = await Promise.all([
        teacherExamService.list(),
        teacherExamService.listSubjects(),
      ]);
      const mappedExams = apiExams.map((exam) => toManagerExam(exam, apiSubjects));
      setSubjects(apiSubjects);
      setExams(mappedExams);
      setSelectedExamId((current) =>
        current && (current.startsWith("new-") || mappedExams.some((exam) => exam.id === current))
          ? current
          : mappedExams[0]?.id ?? null,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load exams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadManagerData();
  }, []);

  useEffect(() => {
    if (initialExamId) setSelectedExamId(initialExamId);
  }, [initialExamId]);

  const handleCreateNew = () => setSelectedExamId(`new-${Date.now()}`);

  const handleSaveExam = async (examData: {
    id: string;
    title: string;
    description: string;
    subjectId: string;
    duration: number;
    examCode: string;
    maxAttempt: number;
    totalPoints: number;
    passingScore: number;
    startTime: string;
    endTime: string;
    status: ExamStatus;
  }) => {
    const payload = {
      title: examData.title.trim(),
      examcode: examData.examCode.trim(),
      max_attempt: examData.maxAttempt,
      description: examData.description.trim(),
      duration_minutes: examData.duration,
      start_time: examData.startTime,
      end_time: examData.endTime,
      status: examData.status,
      result_visibility: "full" as const,
      subject_id: examData.subjectId,
      total_points: examData.totalPoints,
      passing_score: examData.passingScore,
    };

    const saved = examData.id.startsWith("new-")
      ? await teacherExamService.create(payload)
      : await teacherExamService.update(Number(examData.id), payload);
    await loadManagerData();
    setSelectedExamId(String(saved.exam_id));
    toast.success(examData.id.startsWith("new-") ? "Exam created successfully." : "Exam updated successfully.");
  };

  const handleDeleteExam = async (examId: string) => {
    await teacherExamService.delete(Number(examId));
    const remaining = exams.filter((exam) => exam.id !== examId);
    setExams(remaining);
    setSelectedExamId((current) => current === examId ? remaining[0]?.id ?? null : current);
    toast.success("Exam deleted successfully.");
  };

  if (loading) {
    return <div className="h-[calc(100vh-64px)] flex items-center justify-center text-gray-600">Loading exams...</div>;
  }

  if (loadError) {
    return <div className="h-[calc(100vh-64px)] flex flex-col gap-3 items-center justify-center text-red-600"><p>{loadError}</p><button className="underline" onClick={() => void loadManagerData()}>Retry</button></div>;
  }

  const selectedExam = exams.find((exam) => exam.id === selectedExamId) ?? null;

  return (
    <div className="h-[calc(100vh-64px)] flex">
      <div className="w-[35%] min-w-[320px] max-w-[500px]">
        <ExamListSidebar
          exams={exams}
          selectedExamId={selectedExamId}
          onSelectExam={setSelectedExamId}
          onCreateNew={handleCreateNew}
          onDeleteExam={handleDeleteExam}
        />
      </div>
      <div className="flex-1">
        <ExamEditor
          examId={selectedExamId}
          exam={selectedExam}
          subjects={subjects}
          onClose={() => setSelectedExamId(null)}
          onSave={handleSaveExam}
        />
      </div>
    </div>
  );
}
