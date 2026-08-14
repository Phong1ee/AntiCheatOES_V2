import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  Upload,
} from "lucide-react";
import {
  adminQuestionBankService,
  type AdminNewSubjectQuestionImportResult,
  type AdminQuestionImportPreview,
  type AdminQuestionImportResult,
  type ImportTaxonomyAction,
} from "../../services/admin-question-bank.service";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface SelectedSubject {
  subjectId: string;
  subjectName: string;
}

interface AdminQuestionImportModalProps {
  open: boolean;
  mode?: "existing-subject" | "new-subject";
  subject?: SelectedSubject;
  onClose: () => void;
  onImported: (result: AdminQuestionImportResult | AdminNewSubjectQuestionImportResult) => void;
}

function actionLabel(action: ImportTaxonomyAction) {
  return action === "reuse" ? "Existing" : action === "create" ? "New" : "Conflict";
}

function actionClass(action: ImportTaxonomyAction) {
  return action === "reuse"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : action === "create"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-red-50 text-red-700 border-red-200";
}

function questionTypeLabel(type: "MCQ" | "true-false" | "essay") {
  if (type === "MCQ") return "MCQ";
  return type === "true-false" ? "True / False" : "Essay";
}

function formatImportError(error: unknown, selectedSubjectId: string): string {
  const message = error instanceof Error ? error.message : "Unable to process this import file.";
  const match = message.match(/belongs to subject ([^,]+), but the selected subject is/i);
  return match ? `This file belongs to ${match[1]} and cannot be imported into ${selectedSubjectId}.` : message;
}

export function AdminQuestionImportModal({ open, mode = "existing-subject", subject, onClose, onImported }: AdminQuestionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AdminQuestionImportPreview | null>(null);
  const [result, setResult] = useState<AdminQuestionImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [templateViewed, setTemplateViewed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = isPreviewing || isImporting;
  const isNewSubject = mode === "new-subject";
  const subjectName = isNewSubject ? preview?.subject.subject_name ?? "New Subject from file" : subject?.subjectName ?? "Selected Subject";
  const subjectId = isNewSubject ? preview?.subject.subject_id ?? "Read from file" : subject?.subjectId ?? "";
  const templateSubjectId = isNewSubject ? "NEW_SUBJECT_ID" : subject?.subjectId ?? "SELECTED_SUBJECT_ID";
  const templateSubjectName = isNewSubject ? "New Subject Name" : subject?.subjectName ?? "Selected Subject Name";
  const questionTemplate = `Question Bank\n\nSubject ID: ${templateSubjectId}\nSubject Name: ${templateSubjectName}\nDescription: Brief subject description\n\nCHAPTER: Chapter 1\n\nQUESTION 1\nType: Multiple Choice\nDifficulty: Easy\nLearning Objectives: Learning objective 1 | Learning objective 2\nContent: What is 2 + 2?\nA. 3\nB. 4\nAnswer: B\n\nQUESTION 2\nType: True/False\nDifficulty: Medium\nLearning Objectives: Learning objective 1\nContent: The statement is true.\nAnswer: True\n\nQUESTION 3\nType: Essay\nDifficulty: Hard\nLearning Objectives: Learning objective 2\nContent: Explain your reasoning.`;
  const hasBlockingIssues = !!preview && (
    preview.summary.error_questions > 0
    || preview.chapters.some((chapter) => chapter.action === "conflict")
    || preview.learning_objectives.some((lo) => lo.action === "conflict")
  );

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setResult(null);
      setError(null);
      setIsPreviewing(false);
      setIsImporting(false);
      setTemplateViewed(false);
    }
  }, [open]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const extension = candidate.name.toLowerCase().match(/\.(docx|pdf)$/)?.[1];
    if (!extension) {
      setError("Only .docx and text-based .pdf files are supported.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("The selected file exceeds the 5 MB limit.");
      return;
    }
    setFile(candidate);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0]);

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!isBusy) selectFile(event.dataTransfer.files[0]);
  };

  const handlePreview = async () => {
    if (!file || isBusy) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const response = isNewSubject
        ? await adminQuestionBankService.previewNewSubjectImport(file)
        : await adminQuestionBankService.previewImport(file, subject?.subjectId ?? "");
      setPreview(response);
    } catch (requestError) {
      setPreview(null);
      setError(formatImportError(requestError, subject?.subjectId ?? "the selected Subject"));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview || hasBlockingIssues || isBusy) return;
    setIsImporting(true);
    setError(null);
    try {
      const importResult = isNewSubject
        ? await adminQuestionBankService.importNewSubjectQuestions(file)
        : await adminQuestionBankService.importQuestions(file, subject?.subjectId ?? "");
      setResult(importResult);
      onImported(importResult);
    } catch (requestError) {
      setError(formatImportError(requestError, subject?.subjectId ?? "the selected Subject"));
    } finally {
      setIsImporting(false);
    }
  };

  const goBackToUpload = () => {
    if (isBusy) return;
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isBusy) onClose(); }}>
      <DialogContent
        className="max-w-4xl gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(event) => { if (isBusy) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (isBusy) event.preventDefault(); }}
      >
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50">
              <Upload className="size-5 text-teal-600" />
            </div>
            <div>
              <DialogTitle className="text-base text-gray-900">{isNewSubject ? "Import New Subject" : "Import Questions to"}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{subjectName}</span>
                <span className="mx-1.5 text-gray-300">|</span>
                {subjectId}
              </DialogDescription>
            </div>
          </div>
          <div className="mt-4 flex gap-2 text-xs font-medium">
            {(["Template", "Upload", "Preview", "Import Result"] as const).map((step, index) => {
              const active = !templateViewed ? index === 0 : result ? index <= 3 : preview ? index <= 2 : index <= 1;
              return (
                <div key={step} className={`flex items-center gap-1.5 ${active ? "text-teal-700" : "text-gray-400"}`}>
                  <span className={`flex size-5 items-center justify-center rounded-full ${active ? "bg-teal-600 text-white" : "bg-gray-100"}`}>{index + 1}</span>
                  {step}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!templateViewed && !preview && !result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><p className="font-semibold">Question Bank document template</p><p className="mt-1">Save this content as DOCX or a text-based PDF. For an existing Subject, Subject ID must match the selected Subject exactly.</p><a href="/templates/question-bank-import-template.docx" download="question-bank-import-template.docx" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"><Download className="size-4" />Download DOCX template</a></div>
              <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">{questionTemplate}</pre>
              <div className="grid gap-3 text-xs text-gray-600 sm:grid-cols-2"><div className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-800">Required fields</p><p className="mt-1">Subject ID, Subject Name, Chapter, Type, Difficulty, Learning Objectives, and Content. Description is optional.</p></div><div className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-800">Question types</p><p className="mt-1">MCQ needs 2-6 options (A-F) and Answer labels such as B or A,C. True/False uses Answer: True or False with no options. Essay has no options and no Answer.</p></div><div className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-800">Taxonomy</p><p className="mt-1">Start each group with CHAPTER: name. Separate multiple Learning Objectives with |. Existing names are reused; unambiguous new names are created after import.</p></div><div className="rounded-lg border border-gray-200 p-3"><p className="font-semibold text-gray-800">Limits and format</p><p className="mt-1">Use DOCX or text-based PDF under 5 MB. Difficulty must be Easy, Medium, or Hard. IDs, names, question text, and options have length limits checked during Preview.</p></div></div>
            </div>
          )}

          {templateViewed && !preview && !result && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="mb-3 size-7 text-teal-600" />
                <span className="text-sm font-semibold text-gray-800">{file ? file.name : "Drop a file here or choose a file"}</span>
                <span className="mt-1 text-xs text-gray-500">DOCX or text-based PDF · Max 5 MB</span>
                <span className="mt-1 text-xs text-gray-400">Scanned/image-only PDFs are not supported.</span>
              </button>
              <input ref={inputRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileChange} />
              {file && <p className="flex items-center gap-2 text-xs text-emerald-700"><FileCheck2 className="size-4" />Ready to preview: {file.name}</p>}
            </div>
          )}

          {preview && !result && (
            <div className="space-y-5">
              {preview.subject.warnings.map((warning) => (
                <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</div>
              ))}
              {isNewSubject && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
                  Confirming this import creates Subject <strong>{preview.subject.subject_name}</strong> ({preview.subject.subject_id}) from the file metadata.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Total Questions", preview.summary.total_questions],
                  ["Valid", preview.summary.valid_questions],
                  ["Duplicates", preview.summary.duplicate_questions],
                  ["Errors", preview.summary.error_questions],
                  ["New Chapters", preview.summary.chapters_to_create],
                  ["New Learning Objectives", preview.summary.learning_objectives_to_create],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <p className="text-lg font-semibold text-gray-800">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Chapter changes</h3>
                <div className="space-y-1.5">
                  {preview.chapters.map((chapter) => (
                    <div key={chapter.chapter_name} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <span className="text-gray-700">{chapter.chapter_name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${actionClass(chapter.action)}`}>{actionLabel(chapter.action)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Learning Objective changes</h3>
                <div className="space-y-1.5">
                  {preview.learning_objectives.map((lo) => (
                    <div key={`${lo.chapter_name}-${lo.lo_name}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <span className="text-gray-700"><span className="text-gray-400">{lo.chapter_name}</span><span className="mx-1.5 text-gray-300">/</span>{lo.lo_name}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${actionClass(lo.action)}`}>{actionLabel(lo.action)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Questions</h3>
                <div className="space-y-2">
                  {preview.questions.map((question) => (
                    <article key={question.question_number} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-gray-500">Question {question.question_number} · {questionTypeLabel(question.question_type)} · {question.difficulty}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${question.status === "valid" ? "bg-emerald-50 text-emerald-700" : question.status === "duplicate" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{question.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-800">{question.question_text}</p>
                      <p className="mt-1 text-xs text-gray-500">Chapter: {question.chapter_name}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {question.learning_objectives.map((lo) => <span key={lo} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{lo}</span>)}
                      </div>
                      {question.errors.map((item) => <p key={item} className="mt-2 text-xs text-red-700">{item}</p>)}
                      {question.warnings.map((item) => <p key={item} className="mt-2 text-xs text-amber-700">{item}</p>)}
                    </article>
                  ))}
                </div>
              </section>
              {hasBlockingIssues && <p className="text-sm text-red-700">Resolve all parser errors and taxonomy conflicts before importing.</p>}
            </div>
          )}

          {result && (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-900">{isNewSubject ? "New Subject import complete" : "Import complete"}</h3>
              <p className="mt-2 text-sm text-gray-600">{result.imported_count} question{result.imported_count === 1 ? "" : "s"} imported successfully. {result.duplicate_skipped_count} duplicate{result.duplicate_skipped_count === 1 ? " was" : "s were"} skipped.</p>
              <p className="mt-2 text-xs text-gray-500">{result.chapters_created} new chapter{result.chapters_created === 1 ? "" : "s"} and {result.learning_objectives_created} new learning objective{result.learning_objectives_created === 1 ? "" : "s"} created.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {preview && !result ? (
            <button type="button" disabled={isBusy} onClick={goBackToUpload} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"><ChevronLeft className="size-4" />Change file</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" disabled={isBusy} onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">{result ? "Close" : "Cancel"}</button>
            {!templateViewed && !preview && !result && <button type="button" onClick={() => setTemplateViewed(true)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Continue to Upload</button>}
            {templateViewed && !preview && !result && <button type="button" disabled={!file || isBusy} onClick={() => void handlePreview()} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{isPreviewing && <LoaderCircle className="size-4 animate-spin" />}Preview</button>}
            {preview && !result && <button type="button" disabled={hasBlockingIssues || isBusy} onClick={() => void handleImport()} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{isImporting && <LoaderCircle className="size-4 animate-spin" />}{isImporting ? "Importing..." : isNewSubject ? "Confirm & Create Subject" : "Import"}</button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
