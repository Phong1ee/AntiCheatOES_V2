import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Eye, FileSpreadsheet, FileText, LoaderCircle, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { adminBulkDataRequestService, type AdminBulkDataRequest, type AdminBulkRequestStatus, type AdminBulkRequestType, type AdminBulkPreview } from "../../services/admin-bulk-data-request.service";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";

const statuses: AdminBulkRequestStatus[] = ["PENDING", "PROCESSING", "IMPORTED", "REJECTED", "FAILED"];

function requestLabel(type: AdminBulkRequestType) { return type === "QUESTION_BANK" ? "Question Bank" : "User Import"; }
function dateTime(value: string | null) { return value ? new Date(value).toLocaleString() : "-"; }
function fileSize(bytes: number) { return `${(bytes / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 0)} ${bytes >= 1024 * 1024 ? "MB" : "KB"}`; }
function statusStyle(status: AdminBulkRequestStatus) { return { PENDING: "bg-amber-50 text-amber-800", PROCESSING: "bg-sky-50 text-sky-800", IMPORTED: "bg-emerald-50 text-emerald-800", REJECTED: "bg-red-50 text-red-800", FAILED: "bg-gray-100 text-gray-700" }[status]; }

export function AdminBulkDataRequestsPage() {
  const [items, setItems] = useState<AdminBulkDataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminBulkDataRequest | null>(null);
  const [preview, setPreview] = useState<AdminBulkPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminBulkRequestStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<AdminBulkRequestType | "ALL">("ALL");
  const pollId = useRef<number | null>(null);

  const clearPolling = () => { if (pollId.current !== null) { window.clearInterval(pollId.current); pollId.current = null; } };
  useEffect(() => () => clearPolling(), []);

  const load = async () => {
    setLoading(true);
    try { setItems((await adminBulkDataRequestService.list()).items); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load bulk requests."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const refreshSelected = async (requestId: number) => {
    const current = await adminBulkDataRequestService.get(requestId);
    setSelected(current);
    return current;
  };

  const startPolling = (jobId: number, requestId: number) => {
    clearPolling();
    const poll = async () => {
      try {
        const job = await adminBulkDataRequestService.getImportJob(jobId);
        if (job.status !== "COMPLETED" && job.status !== "FAILED") return;
        clearPolling();
        const request = await refreshSelected(requestId);
        await load();
        toast[job.status === "COMPLETED" ? "success" : "error"](job.status === "COMPLETED" ? "Background import completed." : job.error ?? "Background import failed.");
        if (request.status !== "PROCESSING") setImporting(false);
      } catch (error) {
        clearPolling(); setImporting(false);
        toast.error(error instanceof Error ? error.message : "Unable to refresh import status.");
      }
    };
    pollId.current = window.setInterval(() => { void poll(); }, 2_000);
  };

  const openReview = async (requestId: number) => {
    try { setSelected(await adminBulkDataRequestService.get(requestId)); setPreview(null); setReason(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load request details."); }
  };
  const showPreview = async () => {
    if (!selected) return;
    setPreviewing(true);
    try { setPreview(await adminBulkDataRequestService.preview(selected.request_id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to preview this file."); }
    finally { setPreviewing(false); }
  };
  const reject = async () => {
    if (!selected || !reason.trim()) { toast.error("A rejection reason is required."); return; }
    setRejecting(true);
    try { setSelected(await adminBulkDataRequestService.reject(selected.request_id, reason.trim())); setPreview(null); await load(); toast.success("Request rejected."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to reject request."); }
    finally { setRejecting(false); }
  };
  const importRequest = async () => {
    if (!selected) return;
    setImporting(true);
    try {
      const result = await adminBulkDataRequestService.importRequest(selected.request_id);
      setSelected(result.request); setPreview(null); await load();
      if (result.background) { toast.success("Import queued for background processing."); startPolling(result.job.jobId, result.request.request_id); }
      else { toast.success("Request imported."); setImporting(false); }
    } catch (error) { setImporting(false); toast.error(error instanceof Error ? error.message : "Unable to import request."); }
  };
  const visible = items.filter((item) => (statusFilter === "ALL" || item.status === statusFilter) && (typeFilter === "ALL" || item.request_type === typeFilter));

  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6"><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-gray-900">Bulk Requests</h2><p className="mt-1 text-sm text-gray-500">Review files submitted by Teachers before importing data.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div><div className="mb-4 flex flex-wrap gap-3"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminBulkRequestStatus | "ALL")} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}</select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AdminBulkRequestType | "ALL")} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"><option value="ALL">All request types</option><option value="QUESTION_BANK">Question Bank</option><option value="USER_IMPORT">User Import</option></select></div><div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>{["Type", "Requested By", "Subject", "File", "Submitted", "Status", "Actions"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Loading requests...</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No bulk requests match the selected filters.</td></tr> : visible.map((item) => <tr key={item.request_id} className="border-t border-gray-100"><td className="px-4 py-3">{requestLabel(item.request_type)}</td><td className="px-4 py-3 font-medium text-gray-800">{item.requested_by}</td><td className="px-4 py-3">{item.subject ? `${item.subject.subject_id} - ${item.subject.subject_name}` : "-"}</td><td className="max-w-48 truncate px-4 py-3">{item.original_filename} <span className="text-xs text-gray-400">({fileSize(item.file_size)})</span></td><td className="px-4 py-3 text-xs text-gray-500">{dateTime(item.created_at)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyle(item.status)}`}>{item.status}</span></td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => void openReview(item.request_id)}>{item.status === "PENDING" || item.status === "FAILED" ? "Review" : "View"}</Button></td></tr>)}</tbody></table></div>

    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !importing && !rejecting) { setSelected(null); setPreview(null); clearPolling(); } }}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Bulk Request Review</DialogTitle><DialogDescription>Review the Teacher-submitted file on the server; do not upload a replacement file.</DialogDescription></DialogHeader>{selected && <div className="space-y-5"><div className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm sm:grid-cols-2"><p><strong>Teacher:</strong> {selected.requested_by}</p><p><strong>Type:</strong> {requestLabel(selected.request_type)}</p><p><strong>Subject:</strong> {selected.subject ? `${selected.subject.subject_id} - ${selected.subject.subject_name}` : "-"}</p><p><strong>Filename:</strong> {selected.original_filename} ({fileSize(selected.file_size)})</p><p><strong>Submitted:</strong> {dateTime(selected.created_at)}</p><p><strong>Status:</strong> {selected.status}</p><p className="sm:col-span-2"><strong>Teacher note:</strong> {selected.teacher_note || "-"}</p>{selected.admin_note && <p className="sm:col-span-2 text-red-700"><strong>Admin note:</strong> {selected.admin_note}</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void adminBulkDataRequestService.download(selected).catch((error) => toast.error(error instanceof Error ? error.message : "Download unavailable."))}><Download className="size-4" />Download Original</Button><Button variant="outline" onClick={() => void showPreview()} disabled={previewing}>{previewing && <LoaderCircle className="size-4 animate-spin" />}<Eye className="size-4" />Preview</Button>{(selected.status === "PENDING" || selected.status === "FAILED") && <><Button variant="outline" className="text-red-700" onClick={() => setReason(reason || " ")}><X className="size-4" />Reject</Button><Button onClick={() => void importRequest()} disabled={importing}>{importing && <LoaderCircle className="size-4 animate-spin" />}<Send className="size-4" />Import</Button></>}</div>{reason !== "" && (selected.status === "PENDING" || selected.status === "FAILED") && <div className="rounded-xl border border-red-100 bg-red-50 p-3"><label className="text-sm font-medium text-red-900">Rejection reason</label><Textarea className="mt-2 bg-white" value={reason.trim() === "" ? "" : reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Explain what the Teacher should correct" /><div className="mt-2 flex justify-end"><Button size="sm" variant="destructive" disabled={rejecting || !reason.trim()} onClick={() => void reject()}>{rejecting && <LoaderCircle className="size-4 animate-spin" />}Confirm rejection</Button></div></div>}{preview && <PreviewPanel preview={preview} />}{selected.status === "FAILED" && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{typeof selected.result_metadata?.message === "string" ? selected.result_metadata.message : "The background import failed. Review and retry when appropriate."}</p>}</div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)} disabled={importing || rejecting}>Close</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function PreviewPanel({ preview }: { preview: AdminBulkPreview }) {
  if ("rows" in preview.preview) return <section className="space-y-3"><h3 className="font-semibold text-gray-800">User Import Preview</h3><div className="grid grid-cols-4 gap-2">{[["Total", preview.preview.total_rows], ["Valid", preview.preview.valid_count], ["Warnings", preview.preview.warning_count], ["Errors", preview.preview.error_count]].map(([label, value]) => <div key={label as string} className="rounded-lg bg-gray-50 p-3"><strong>{value}</strong><p className="text-xs text-gray-500">{label}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-gray-500"><th className="py-2">School ID</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{preview.preview.rows.map((row) => <tr key={row.row_number} className="border-b"><td className="py-2">{row.school_id}</td><td>{row.full_name}</td><td>{row.email}</td><td>{row.role}</td><td>{row.status}{row.errors.map((error) => <p key={error} className="text-red-700">{error}</p>)}</td></tr>)}</tbody></table></div></section>;
  return <section className="space-y-3"><h3 className="font-semibold text-gray-800">Question Bank Preview</h3><div className="grid grid-cols-3 gap-2">{[["Questions", preview.preview.summary.total_questions], ["Valid", preview.preview.summary.valid_questions], ["Errors", preview.preview.summary.error_questions], ["Duplicates", preview.preview.summary.duplicate_questions], ["New Chapters", preview.preview.summary.chapters_to_create], ["New LOs", preview.preview.summary.learning_objectives_to_create]].map(([label, value]) => <div key={label as string} className="rounded-lg bg-gray-50 p-3"><strong>{value}</strong><p className="text-xs text-gray-500">{label}</p></div>)}</div><div className="space-y-2">{preview.preview.questions.map((question) => <article key={question.question_number} className="rounded-lg border border-gray-100 p-3"><p className="text-xs text-gray-500">Question {question.question_number} - {question.question_type} - {question.difficulty}</p><p className="mt-1 text-sm text-gray-800">{question.question_text}</p>{[...question.errors, ...question.warnings].map((message) => <p key={message} className="mt-1 text-xs text-amber-700">{message}</p>)}</article>)}</div></section>;
}
