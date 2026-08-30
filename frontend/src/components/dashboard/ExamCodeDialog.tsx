import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Info, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { VerifyCodeResult } from "../../services/student-exam.service";

interface ExamCodeDialogProps {
  exam: { id: string; title: string; requiresExamCode: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (code: string) => Promise<VerifyCodeResult>;
  onStart: (code: string) => Promise<void>;
}

export function ExamCodeDialog({ exam, open, onOpenChange, onVerify, onStart }: ExamCodeDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setCode(""); setError(""); setWorking(false); }, [open, exam?.id]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (!exam) return null;

  const verifyAndContinue = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setError("Please enter the exam code."); return; }
    setWorking(true); setError("");
    try { await onVerify(trimmed); await onStart(trimmed); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to verify the exam code."); }
    finally { setWorking(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
    <DialogContent className="oes-dialog-rounded max-w-md gap-0 p-0">
      <div className="rounded-t-2xl border-b border-teal-100 bg-gradient-to-br from-teal-50 via-white to-blue-50 px-6 pt-6 pb-5 pr-10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <Lock className="size-4.5" />
            </span>
            Enter Exam Code
          </DialogTitle>
          <DialogDescription>The code is verified before an attempt is created.</DialogDescription>
        </DialogHeader>
      </div>
      <div className="space-y-4 px-6 pt-5 pb-6">
        <div className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <BookOpen className="size-4 shrink-0 text-teal-700" />
          <p className="text-sm font-semibold text-teal-900">{exam.title}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exam-code">Exam Code</Label>
          <Input
            ref={inputRef}
            id="exam-code"
            value={code}
            className="h-11 rounded-xl text-center text-lg font-semibold uppercase tracking-widest focus-visible:border-teal-400 focus-visible:ring-teal-500/50"
            disabled={working}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verifyAndContinue(); } }}
          />
          {error && <p className="flex gap-1 text-sm text-red-600"><AlertCircle className="size-4" />{error}</p>}
        </div>
        <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Info className="size-4 shrink-0 text-slate-400" />
          Security requirements are shown after code verification.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={working}>Cancel</Button>
          <Button
            className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-sm hover:from-teal-600 hover:to-blue-700"
            onClick={() => void verifyAndContinue()}
            disabled={working}
          >
            {working ? "Verifying..." : "Verify & Continue"}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
