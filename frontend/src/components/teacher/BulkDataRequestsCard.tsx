import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BookOpenCheck, Download, Eye, FileSpreadsheet, FileText, LoaderCircle, RefreshCw, Send, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { teacherBulkDataRequestService, type BulkDataRequestType, type TeacherBulkDataRequest } from "../../services/teacher-bulk-data-request.service";
import { teacherQuestionBankService } from "../../services/teacher-question-bank.service";
import type { SubjectCount } from "../../types/question-bank";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

type TemplateKind = "question" | "user";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const templates = [
  { kind: "question" as const, title: "Question Bank Template", description: "Prepare questions for one assigned subject.", type: "DOCX", path: "/templates/question-bank-import-template.docx", Icon: FileText },
  { kind: "user" as const, title: "User Import Template", description: "Prepare a Users worksheet for administrator review.", type: "XLSX", path: "/templates/user-import-template.xlsx", Icon: FileSpreadsheet },
];

const questionPreview = `QUESTION BANK IMPORT TEMPLATE

SUBJECT
Subject ID: DS310
Subject Name: Fundamentals of Data Science
Description: Core concepts and methods for data-driven decision making.

CHAPTER: Introduction to Data Science
Learning Objectives: LO1.1 | LO1.2

QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Content: Which statement best describes data science?
A. A method for designing computer hardware
B. An interdisciplinary field that extracts knowledge from data
C. A database used only for financial records
D. A programming language for visual design
Answer: B`;

const userHeaders = ["school_id", "full_name", "email", "role", "phone", "date_of_birth", "initial_password"];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function statusClass(status: TeacherBulkDataRequest["status"]): string {
  return {
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    PROCESSING: "border-sky-200 bg-sky-50 text-sky-800",
    IMPORTED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    REJECTED: "border-red-200 bg-red-50 text-red-800",
    FAILED: "border-gray-200 bg-gray-100 text-gray-700",
  }[status];
}

function requestLabel(type: BulkDataRequestType): string {
  return type === "QUESTION_BANK" ? "Question Bank" : "User Import";
}

export function BulkDataRequestsCard() {
  const [preview, setPreview] = useState<TemplateKind | null>(null);
  const [submissionType, setSubmissionType] = useState<BulkDataRequestType | null>(null);
  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<TeacherBulkDataRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTemplate = templates.find((template) => template.kind === preview);
  const isQuestionRequest = submissionType === "QUESTION_BANK";

  async function refreshRequests() {
    setRequestsLoading(true);
    try {
      const result = await teacherBulkDataRequestService.listMyRequests();
      setRequests(result.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your requests.");
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => { void refreshRequests(); }, []);

  useEffect(() => {
    if (!isQuestionRequest) return;
    let cancelled = false;
    setSubjectsLoading(true);
    teacherQuestionBankService.listSubjectCounts("bank")
      .then((data) => { if (!cancelled) setSubjects(data.subjects); })
      .catch((error) => { if (!cancelled) toast.error(error instanceof Error ? error.message : "Unable to load assigned subjects."); })
      .finally(() => { if (!cancelled) setSubjectsLoading(false); });
    return () => { cancelled = true; };
  }, [isQuestionRequest]);

  const closeSubmission = () => {
    if (submitting) return;
    setSubmissionType(null); setSelectedSubject(""); setFile(null); setNote("");
  };

  const chooseFile = (candidate: File | undefined) => {
    if (!candidate || !submissionType) return;
    const lowerName = candidate.name.toLowerCase();
    const accepted = submissionType === "QUESTION_BANK"
      ? lowerName.endsWith(".docx") || lowerName.endsWith(".pdf")
      : lowerName.endsWith(".xlsx");
    if (!accepted) { toast.error(submissionType === "QUESTION_BANK" ? "Choose a .docx or .pdf file." : "Choose an .xlsx file."); return; }
    if (candidate.size > MAX_FILE_SIZE) { toast.error("The selected file exceeds the 5 MB limit."); return; }
    setFile(candidate);
  };

  const submitRequest = async () => {
    if (!submissionType || !file) { toast.error("Choose a file before submitting."); return; }
    if (isQuestionRequest && !selectedSubject) { toast.error("Select a subject for the Question Bank request."); return; }
    if (note.length > 500) { toast.error("The note must be 500 characters or fewer."); return; }
    setSubmitting(true);
    try {
      await teacherBulkDataRequestService.createRequest({ requestType: submissionType, subjectId: isQuestionRequest ? selectedSubject : undefined, teacherNote: note.trim() || undefined, file });
      toast.success("Request submitted to the administrator.");
      closeSubmission();
      await refreshRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit this request.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadRequest = async (request: TeacherBulkDataRequest) => {
    try { await teacherBulkDataRequestService.downloadRequest(request); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The uploaded file is no longer available."); }
  };

  return <>
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader><CardTitle className="flex items-center gap-2 text-gray-800"><Download className="size-5 text-teal-600" />Bulk Data Requests</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-5 text-gray-600">Need to add many questions or users? Download the appropriate template, complete it, and submit the file to an administrator for import.</p>
        {templates.map(({ kind, title, description, type, path, Icon }) => <div key={kind} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-teal-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm text-gray-800">{title}</p><Badge variant="outline" className="bg-white text-[10px]">{type}</Badge></div><p className="mt-1 text-xs leading-4 text-gray-500">{description}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><button type="button" onClick={() => setPreview(kind)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-teal-800"><Eye className="size-3.5" />Preview / Instructions</button><a href={path} download className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Download className="size-3.5" />Download Template</a><button type="button" onClick={() => setSubmissionType(kind === "question" ? "QUESTION_BANK" : "USER_IMPORT")} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Send className="size-3.5" />Submit to Admin</button></div></div></div></div>)}

        <section className="border-t border-gray-100 pt-4" aria-label="My bulk data requests">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-gray-800">My Requests</h3><p className="text-xs text-gray-500">Files are reviewed by an administrator before import.</p></div><Button variant="outline" size="sm" onClick={() => void refreshRequests()} disabled={requestsLoading}><RefreshCw className={`size-3.5 ${requestsLoading ? "animate-spin" : ""}`} />Refresh</Button></div>
          {requestsLoading ? <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500"><LoaderCircle className="size-4 animate-spin" />Loading requests...</div> : requests.length === 0 ? <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">You have not submitted any bulk data requests.</p> : <div className="space-y-2">{requests.map((request) => <article key={request.request_id} className="rounded-xl border border-gray-100 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium text-gray-800">{requestLabel(request.request_type)} <span className="font-normal text-gray-500">- {request.original_filename}</span></p><p className="mt-1 text-xs text-gray-500">{request.subject?.subject_name ?? "No subject"} - Submitted {formatDate(request.created_at)}</p></div><Badge variant="outline" className={`text-[10px] ${statusClass(request.status)}`}>{request.status}</Badge></div>{request.status === "REJECTED" && request.admin_note && <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-800">Admin reason: {request.admin_note}</p>}{request.status === "FAILED" && <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-700">{typeof request.result_metadata?.message === "string" ? request.result_metadata.message : "Processing failed. The administrator can review the request."}</p>}<div className="mt-2 flex justify-end"><button type="button" onClick={() => void downloadRequest(request)} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Download className="size-3.5" />Download file</button></div></article>)}</div>}
        </section>
      </CardContent>
    </Card>

    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpenCheck className="size-5 text-teal-600" />{activeTemplate?.title} Preview</DialogTitle><DialogDescription>Follow this structure before submitting the file to an administrator.</DialogDescription></DialogHeader>{preview === "question" ? <div className="grid gap-4 md:grid-cols-[0.9fr_1.4fr]"><aside className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-xs leading-4 text-gray-600"><p className="font-semibold text-teal-900">How to complete it</p><p>Enter subject information first, group questions by Chapter, then provide type, difficulty, content, and answers.</p><p>Keep field labels unchanged. Each MCQ and True/False question needs a correct answer.</p></aside><div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><pre className="max-h-[52vh] overflow-auto p-4 text-xs leading-5 text-slate-100">{questionPreview}</pre></div></div> : <div className="space-y-4"><div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><p className="font-semibold">User Import template</p><p className="mt-1">Use one worksheet named <strong>Users</strong>. Keep the exact headers and do not add server-controlled columns.</p><p className="mt-2 text-xs">The administrator will review and validate this file before any user accounts are created.</p></div><div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-gray-50 text-gray-600"><tr>{userHeaders.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody><tr className="border-t text-gray-700"><td className="px-3 py-3">SV001</td><td className="px-3 py-3">Nguyen Van A</td><td className="px-3 py-3">sv001@example.edu</td><td className="px-3 py-3">student</td><td className="px-3 py-3">0900000000</td><td className="px-3 py-3">2004-01-15</td><td className="px-3 py-3">InitialPass123</td></tr></tbody></table></div><p className="text-xs text-gray-500">Maximum 1,000 users. Roles are student, teacher, or admin. This example is only for preparing the template; submitted requests never display initial passwords.</p></div>}<div className="flex justify-end"><a href={activeTemplate?.path} download className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"><Download className="size-4" />Download Template</a></div></DialogContent>
    </Dialog>

    <Dialog open={submissionType !== null} onOpenChange={(open) => { if (!open) closeSubmission(); }}>
      <DialogContent className="max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-5 text-teal-600" />Submit {submissionType ? requestLabel(submissionType) : ""} Request</DialogTitle><DialogDescription>{isQuestionRequest ? "Submit a DOCX or text-based PDF for administrator review. It will not import questions immediately." : "Submit an XLSX file for administrator review. It will not create users immediately."}</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"><span className="font-medium">Request Type:</span> {submissionType && requestLabel(submissionType)}</div>{isQuestionRequest && <div className="space-y-1.5"><label className="text-sm font-medium text-gray-700">Subject</label><Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={subjectsLoading || submitting}><SelectTrigger className="w-full border-transparent bg-gray-100 font-normal shadow-none hover:bg-gray-200 focus-visible:border-gray-300"><SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select an assigned subject"} /></SelectTrigger><SelectContent className="max-h-60 border-gray-100 bg-white"><SelectItem value="__placeholder" disabled>Select an assigned subject</SelectItem>{subjects.map((subject) => <SelectItem key={subject.subject_id} value={subject.subject_id}>{subject.subject_id} - {subject.subject_name}</SelectItem>)}</SelectContent></Select></div>}<div><p className="mb-1.5 text-sm font-medium text-gray-700">File</p><button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-4 text-center text-sm text-gray-700"><Upload className="mb-2 size-5 text-teal-600" /><span>{file ? file.name : isQuestionRequest ? "Choose a .docx or .pdf file" : "Choose an .xlsx file"}</span><span className="mt-1 text-xs text-gray-500">Maximum 5 MB</span></button><input ref={fileInputRef} type="file" className="hidden" accept={isQuestionRequest ? ".docx,.pdf" : ".xlsx"} onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])} /></div><label className="block space-y-1.5 text-sm font-medium text-gray-700">Optional note <span className="font-normal text-gray-400">({note.length}/500)</span><Textarea value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} disabled={submitting} placeholder="Add context for the administrator" /></label>{submissionType === "USER_IMPORT" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><UsersRound className="mr-1 inline size-4" />The administrator will review and validate this file before any user accounts are created.</div>}</div><DialogFooter><Button variant="outline" onClick={closeSubmission} disabled={submitting}>Cancel</Button><Button onClick={() => void submitRequest()} disabled={submitting || !file || (isQuestionRequest && !selectedSubject)}>{submitting && <LoaderCircle className="size-4 animate-spin" />}Submit to Admin</Button></DialogFooter></DialogContent>
    </Dialog>
  </>;
}
