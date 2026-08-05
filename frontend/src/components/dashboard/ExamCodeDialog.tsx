import { useEffect, useRef, useState } from "react";
import { AlertCircle, Info, Lock, Maximize } from "lucide-react";
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
  const [phase, setPhase] = useState<"code" | "fullscreen">("code");
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCode("");
    setError("");
    setWorking(false);
    setPhase(exam?.requiresExamCode ? "code" : "fullscreen");
  }, [open, exam?.id, exam?.requiresExamCode]);

  useEffect(() => { if (open && phase === "code") codeInputRef.current?.focus(); }, [open, phase]);

  if (!exam) return null;
  const requiresCode = exam.requiresExamCode;

  const verify = async () => {
    const trimmed = code.trim();
    if (!trimmed) return setError("Please enter the exam code");
    if (trimmed.length < 6) return setError("Exam code must be at least 6 characters");
    setError("");
    setWorking(true);
    try {
      const verified = await onVerify(trimmed);
      if (verified.requiresFullscreen) setPhase("fullscreen");
      else await onStart(trimmed);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to verify exam code. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const startInFullscreen = async () => {
    setError("");
    setWorking(true);
    try {
      // The browser accepts fullscreen only from this direct button action.
      await document.documentElement.requestFullscreen();
    } catch (error) {
      setError("Fullscreen permission is required to start this exam.");
      setWorking(false);
      return;
    }
    try {
      await onStart(code.trim());
    } catch (error) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setError(error instanceof Error ? error.message : "Unable to start the exam.");
    } finally {
      setWorking(false);
    }
  };

  const close = () => onOpenChange(false);

  return <Dialog open={open} onOpenChange={(next) => !next && close()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-xl">
          {requiresCode ? <Lock className="size-5 text-teal-600" /> : <Maximize className="size-5 text-teal-600" />}
          {requiresCode ? "Enter Exam Code" : "Fullscreen Required"}
        </DialogTitle>
        {phase === "fullscreen" && <DialogDescription>Confirm fullscreen access before your attempt is created.</DialogDescription>}
      </DialogHeader>
      {phase === "code" ? <div className="space-y-5">
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-600">Exam</p>
          <p className="mt-1 text-base font-semibold text-teal-900">{exam.title?.trim() || "Selected Exam"}</p>
        </div>
        <DialogDescription className="text-sm leading-6 text-slate-500">Please enter the exam code provided by your instructor to access this exam.</DialogDescription>
        <div className="space-y-2 pt-2">
          <Label htmlFor="exam-code">Exam Code</Label>
          <Input ref={codeInputRef} id="exam-code" placeholder="Enter your exam code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verify(); } }} className="uppercase" disabled={working} />
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" />{error}</p>}
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500"><Info className="size-5 shrink-0 text-blue-500" />The code is verified before your attempt starts.</p>
        <div className="flex gap-4 pt-1"><Button variant="outline" className="flex-1" onClick={close} disabled={working}>Cancel</Button><Button className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => void verify()} disabled={working}>{working ? "Verifying..." : "Verify & Enter"}</Button></div>
      </div> : <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center"><Maximize className="mx-auto mb-3 size-8 text-teal-700" /><p className="font-medium text-teal-900">This exam requires fullscreen mode.</p><p className="mt-2 text-sm text-teal-800">Leaving fullscreen will be recorded as a violation.</p></div>
        {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" />{error}</p>}
        <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => requiresCode ? setPhase("code") : close()} disabled={working}>{requiresCode ? "Back" : "Cancel"}</Button><Button className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => void startInFullscreen()} disabled={working}>{working ? "Starting..." : "Enter Fullscreen & Start Exam"}</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
