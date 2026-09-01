import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { adminUserService } from "../../services/admin-user.service";
import type { AdminUserImportPreviewResponse, AdminUserImportResult } from "../../types/admin-user";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TEMPLATE_HEADERS = ["full_name", "email", "role", "phone", "date_of_birth", "initial_password"];

interface AdminUserImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}

export function AdminUserImportModal({ open, onClose, onImported }: AdminUserImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AdminUserImportPreviewResponse | null>(null);
  const [result, setResult] = useState<AdminUserImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [templateViewed, setTemplateViewed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = isPreviewing || isImporting;

  useEffect(() => {
    if (!open) {
      setFile(null); setPreview(null); setResult(null); setError(null);
      setIsPreviewing(false); setIsImporting(false); setTemplateViewed(false);
    }
  }, [open]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate || isBusy) return;
    if (!candidate.name.toLowerCase().endsWith(".xlsx")) { setError("Only .xlsx files are supported."); return; }
    if (candidate.size > MAX_FILE_SIZE) { setError("The selected file exceeds the 5 MB limit."); return; }
    setFile(candidate); setPreview(null); setResult(null); setError(null);
  };

  const previewFile = async () => {
    if (!file || isBusy) return;
    setIsPreviewing(true); setError(null);
    try { setPreview(await adminUserService.previewImport(file)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to preview this file."); }
    finally { setIsPreviewing(false); }
  };

  const importFile = async () => {
    if (!file || !preview || preview.error_count > 0 || isBusy) return;
    setIsImporting(true); setError(null);
    try {
      const importResult = await adminUserService.importUsers(file);
      setResult(importResult);
      await onImported();
      toast.success(`${importResult.imported_count} users imported successfully.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this file.");
    } finally { setIsImporting(false); }
  };

  const step = !templateViewed ? 0 : result ? 3 : preview ? 2 : 1;

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isBusy) onClose(); }}>
    <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0" onEscapeKeyDown={(event) => { if (isBusy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (isBusy) event.preventDefault(); }}>
      <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
        <DialogTitle className="flex items-center gap-2 text-base text-gray-900"><FileSpreadsheet className="size-5 text-teal-600" />Import Users</DialogTitle>
        <DialogDescription>XLSX - Max 5 MB - Up to 1,000 users. Passwords are never shown after upload.</DialogDescription>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-gray-500">{["Template", "Upload", "Preview", "Import Result"].map((label, index) => <span key={label} className={index <= step ? "text-teal-700" : ""}>{index + 1}. {label}</span>)}</div>
      </DialogHeader>
      <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
        {error && <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="size-4 shrink-0" />{error}</div>}
        {!templateViewed && !preview && !result && <div className="space-y-4"><div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><p className="font-semibold">User import template</p><p className="mt-1">Create one worksheet named <strong>Users</strong>. Keep these headers exactly as shown; do not add school_id, password_hash, id, locked, or audit columns.</p><p className="mt-1">The system generates a unique School ID automatically: <strong>S</strong> for students, <strong>T</strong> for teachers, and <strong>A</strong> for administrators.</p><a href="/templates/user-import-template.xlsx" download="user-import-template.xlsx" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"><Download className="size-4" />Download XLSX template</a></div><div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-gray-50 text-gray-600"><tr>{TEMPLATE_HEADERS.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody><tr className="border-t text-gray-700"><td className="px-3 py-3">Nguyen Van A</td><td className="px-3 py-3">nguyen.van.a@example.edu</td><td className="px-3 py-3">student</td><td className="px-3 py-3">0900000000</td><td className="px-3 py-3">2004-01-15</td><td className="px-3 py-3">InitialPass123</td></tr></tbody></table></div><p className="text-xs text-gray-500">Valid roles: student, teacher, admin. Date of birth must be an Excel date or YYYY-MM-DD. Maximum 1,000 rows.</p></div>}
        {templateViewed && !preview && !result && <><button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }} className="flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-6 text-center"><Upload className="mb-3 size-7 text-teal-600" /><span className="font-semibold">{file?.name ?? "Drop an XLSX file here or choose a file"}</span><span className="mt-1 text-xs text-gray-500">XLSX - Max 5 MB - Up to 1,000 users</span></button><input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0])} /></>}
        {preview && !result && <div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Total users", preview.total_rows], ["Valid", preview.valid_count], ["Warnings", preview.warning_count], ["Errors", preview.error_count]].map(([label, value]) => <div key={label as string} className="rounded-lg bg-gray-50 p-3"><strong className="text-lg">{value}</strong><p className="text-xs text-gray-500">{label}</p></div>)}</div>{preview.rows.some((row) => row.role === "admin") && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This file contains {preview.rows.filter((row) => row.role === "admin").length} administrator account(s).</div>}{preview.error_count > 0 && <p className="text-sm font-medium text-red-700">Fix the errors in the file and upload it again.</p>}<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b text-gray-500"><tr><th className="py-2">School ID</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row_number} className="border-b"><td className="py-3 align-middle">{row.school_id}</td><td className="align-middle">{row.full_name}</td><td className="align-middle">{row.email}</td><td className="align-middle">{row.role}</td><td className={`align-middle ${row.status === "valid" ? "text-emerald-700" : "text-red-700"}`}>{row.status}{[...row.errors, ...row.warnings].map((message) => <p key={message} className="mt-1 max-w-xs">{message}</p>)}</td></tr>)}</tbody></table></div></div>}
        {result && <div className="py-8 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h3 className="mt-3 font-semibold">{result.imported_count} users imported successfully.</h3><p className="mt-1 text-sm text-gray-500">{result.role_counts.student} Students - {result.role_counts.teacher} Teachers - {result.role_counts.admin} Admins</p></div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4"><button disabled={isBusy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">{result ? "Close" : "Cancel"}</button>{!templateViewed && !preview && !result && <button onClick={() => setTemplateViewed(true)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white">Continue to Upload</button>}{templateViewed && !preview && !result && <button disabled={!file || isBusy} onClick={() => void previewFile()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-50">{isPreviewing && <LoaderCircle className="mr-1 inline size-4 animate-spin" />}Preview</button>}{preview && !result && <button disabled={preview.error_count > 0 || isBusy} onClick={() => void importFile()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-50">{isImporting && <LoaderCircle className="mr-1 inline size-4 animate-spin" />}Import Users</button>}</div>
    </DialogContent>
  </Dialog>;
}
