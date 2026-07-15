import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExamEditor } from "./ExamEditor";
import { ExamListSidebar } from "./ExamListSidebar";
import { teacherExamService } from "../../../services/teacher-exam.service";
import type { TeacherExamApi, TeacherSubject } from "../../../types/teacher-exam";

interface Exam {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  class: string;
  status: "draft" | "scheduled" | "published" | "archived";
  date: string;
  questionCount: number;
  assignedStudents: number;
  averageScore: number | null;
  duration?: number;
  examCode?: string;
  description?: string;
}

const toManagerExam = (exam: TeacherExamApi, subjects: TeacherSubject[]): Exam => ({
  id: String(exam.exam_id),
  title: exam.title,
  subject: exam.subject ?? "No subject",
  subjectId: subjects.find((subject) => subject.subject_name === exam.subject)?.subject_id ?? "",
  class: "Unassigned",
  status: exam.status === "upcoming" ? "scheduled" : exam.status === "ongoing" ? "published" : "archived",
  date: exam.start_time ?? new Date().toISOString(),
  questionCount: 0,
  assignedStudents: exam.totalStudents,
  averageScore: null,
  duration: exam.duration_minutes ?? 0,
  examCode: exam.examcode,
  description: exam.description ?? "",
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
      setSelectedExamId((current) => current ?? mappedExams[0]?.id ?? null);
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
  }) => {
    const payload = {
      title: examData.title.trim(),
      examcode: examData.examCode.trim(),
      max_attemmpt: 1,
      description: examData.description.trim(),
      duration_minutes: examData.duration,
      result_visibility: "full" as const,
      subject_id: examData.subjectId,
    };

    if (examData.id.startsWith("new-")) {
      await teacherExamService.create(payload);
    } else {
      await teacherExamService.update(Number(examData.id), payload);
    }

    await loadManagerData();
    const savedExam = (await teacherExamService.list()).find((exam) => exam.examcode === payload.examcode);
    setSelectedExamId(savedExam ? String(savedExam.exam_id) : null);
    toast.success(examData.id.startsWith("new-") ? "Exam created successfully." : "Exam updated successfully.");
  };

  if (loading) {
    return <div className="h-[calc(100vh-64px)] flex items-center justify-center text-gray-600">Loading exams...</div>;
  }

  if (loadError) {
    return <div className="h-[calc(100vh-64px)] flex items-center justify-center text-red-600">{loadError}</div>;
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
