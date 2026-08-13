import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreateExamDialog, type CreateExamDraft } from "./CreateExamDialog";
import { ExamEditor } from "./ExamEditor";
import { ExamListSidebar } from "./ExamListSidebar";
import { teacherExamService } from "../../../services/teacher-exam.service";
import type { ExamStatus, ResultVisibility, TeacherExamApi, TeacherSubject } from "../../../types/teacher-exam";
import { LoadingState } from "../common/LoadingState";

interface Exam {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  status: ExamStatus;
  startTime: string;
  endTime: string;
  date: string;
  questionCount: number;
  assignedStudents: number;
  averageScore: number | null;
  duration?: number;
  examCode: string | null;
  description?: string;
  maxAttempt: number;
  passingScore: number;
  resultVisibility: ResultVisibility;
}

const toManagerExam = (exam: TeacherExamApi): Exam => ({
  id: String(exam.exam_id),
  title: exam.title,
  subject: exam.subject ?? "No subject",
  subjectId: exam.subject_id ?? "",
  status: exam.status,
  startTime: exam.start_time ?? "",
  endTime: exam.end_time ?? "",
  date: exam.start_time ?? new Date().toISOString(),
  questionCount: exam.question_count ?? 0,
  assignedStudents: exam.totalStudents,
  averageScore: null,
  duration: exam.duration_minutes ?? 0,
  examCode: exam.examcode,
  description: exam.description ?? "",
  maxAttempt: exam.max_attempt ?? 1,
  passingScore: exam.passing_score,
  resultVisibility: exam.result_visibility ?? "hidden",
});

type EditorTab = 'general' | 'questions' | 'settings';

interface ExamManagerPageProps {
  initialExamId?: string | null;
  initialTab?: 'general' | 'settings';
  onViewInQuestionBank: (questionId: number, tab: 'bank' | 'mine') => void;
}

export function ExamManagerPage({ initialExamId, initialTab, onViewInQuestionBank }: ExamManagerPageProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(initialExamId ?? null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab | undefined>(initialTab);
  const [editorDirty, setEditorDirty] = useState(false);

  /** Leaving the open exam would drop whatever has not been saved yet. */
  const confirmLeaveEditor = () =>
    !editorDirty
    || window.confirm('This exam has unsaved changes that will be lost. Leave anyway?');

  const loadManagerData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [apiExams, apiSubjects] = await Promise.all([
        teacherExamService.list(),
        teacherExamService.listSubjects(),
      ]);
      const mappedExams = apiExams.map(toManagerExam);
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

  useEffect(() => {
    setEditorTab(initialTab);
  }, [initialTab]);

  const handleCreateNew = () => setCreateDialogOpen(true);

  const handleCreateExam = async (draft: CreateExamDraft) => {
    const created = await teacherExamService.create({
      title: draft.title.trim(),
      examcode: draft.examCode?.trim() || null,
      max_attempt: draft.maxAttempt,
      description: draft.description.trim(),
      duration_minutes: draft.duration,
      start_time: draft.startTime,
      end_time: draft.endTime,
      status: "draft",
      result_visibility: "hidden",
      subject_id: draft.subjectId,
      total_points: 100 as const,
      passing_score: draft.passingScore,
    });
    await loadManagerData();
    setSelectedExamId(String(created.exam_id));
    // Land on Questions: the exam details are already captured, so adding
    // questions is the next step in the flow.
    setEditorTab("questions");
    toast.success("Exam created successfully.");
  };

  const handleSaveExam = async (examData: {
    id: string;
    title: string;
    description: string;
    subjectId: string;
    duration: number;
    examCode: string | null;
    maxAttempt: number;
    passingScore: number;
    startTime: string;
    endTime: string;
    status: ExamStatus;
    resultVisibility: ResultVisibility;
  }) => {
    const payload = {
      title: examData.title.trim(),
      examcode: examData.examCode?.trim() || null,
      max_attempt: examData.maxAttempt,
      description: examData.description.trim(),
      duration_minutes: examData.duration,
      start_time: examData.startTime,
      end_time: examData.endTime,
      status: examData.status,
      result_visibility: examData.resultVisibility,
      subject_id: examData.subjectId,
      total_points: 100 as const,
      passing_score: examData.passingScore,
    };

    const saved = examData.id.startsWith("new-")
      ? await teacherExamService.create(payload)
      : await teacherExamService.update(Number(examData.id), payload);
    await loadManagerData();
    setSelectedExamId(String(saved.exam_id));
    toast.success(examData.id.startsWith("new-") ? "Exam created successfully." : "Exam updated successfully.");
  };

  const handleResultVisibilityChange = async (examId: string, resultVisibility: ResultVisibility) => {
    const saved = await teacherExamService.updateResultVisibility(Number(examId), resultVisibility);
    setExams((current) => current.map((exam) => (
      exam.id === examId ? { ...exam, resultVisibility: saved.result_visibility } : exam
    )));
  };

  const handleDeleteExam = async (examId: string) => {
    await teacherExamService.delete(Number(examId));
    const remaining = exams.filter((exam) => exam.id !== examId);
    setExams(remaining);
    setSelectedExamId((current) => current === examId ? remaining[0]?.id ?? null : current);
    toast.success("Exam deleted successfully.");
  };

  const handleDuplicateExam = async (examId: string) => {
    const duplicated = await teacherExamService.duplicate(Number(examId));
    const mappedDuplicate = toManagerExam(duplicated);
    setExams((current) => [mappedDuplicate, ...current]);
    setSelectedExamId(mappedDuplicate.id);
    toast.success("Exam duplicated as a draft.");
  };

  const handleStatusChange = async (examId: string, status: ExamStatus) => {
    const updated = await teacherExamService.updateStatus(Number(examId), status);
    const mappedUpdated = toManagerExam(updated);
    setExams((current) => current.map((exam) => exam.id === examId ? mappedUpdated : exam));
    setSelectedExamId((current) => current && current !== examId ? current : mappedUpdated.id);
    const action = status === "published" ? "published" : "set to draft";
    toast.success(`Exam ${action} successfully.`);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <LoadingState label="Loading exams..." />
      </div>
    );
  }

  if (loadError) {
    return <div className="h-[calc(100vh-80px)] flex flex-col gap-3 items-center justify-center text-red-600"><p>{loadError}</p><button className="underline" onClick={() => void loadManagerData()}>Retry</button></div>;
  }

  const selectedExam = exams.find((exam) => exam.id === selectedExamId) ?? null;

  return (
    <div className="h-[calc(100vh-80px)] flex overflow-hidden">
      <div className="w-[35%] min-w-[320px] max-w-[500px]">
        <ExamListSidebar
          exams={exams}
          selectedExamId={selectedExamId}
          onSelectExam={(id) => {
            if (id === selectedExamId || !confirmLeaveEditor()) return;
            setEditorDirty(false);
            setEditorTab(undefined);
            setSelectedExamId(id);
          }}
          onCreateNew={handleCreateNew}
          onDeleteExam={handleDeleteExam}
          onDuplicateExam={handleDuplicateExam}
          onStatusChange={handleStatusChange}
        />
      </div>
      <div className="flex-1">
        <ExamEditor
          examId={selectedExamId}
          exam={selectedExam}
          subjects={subjects}
          initialTab={editorTab}
          onClose={() => { if (confirmLeaveEditor()) { setEditorDirty(false); setSelectedExamId(null); } }}
          onDirtyChange={setEditorDirty}
          onSave={handleSaveExam}
          onResultVisibilityChange={handleResultVisibilityChange}
          onStatusChange={handleStatusChange}
          onViewInQuestionBank={onViewInQuestionBank}
        />
      </div>

      <CreateExamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        subjects={subjects}
        onCreate={handleCreateExam}
      />
    </div>
  );
}
