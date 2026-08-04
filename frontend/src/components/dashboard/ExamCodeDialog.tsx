import { useEffect, useState } from "react";
import { AlertCircle, Lock, Maximize } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { VerifyCodeResult } from "../../services/student-exam.service";

interface ExamCodeDialogProps {
  exam: { id: string; title: string; examCode: string | null } | null;
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

  useEffect(() => {
    setCode("");
    setError("");
    setWorking(false);
    setPhase(exam?.examCode === null ? "fullscreen" : "code");
  }, [open, exam?.id, exam?.examCode]);

  if (!exam) return null;
  const requiresCode = exam.examCode !== null;

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
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {requiresCode ? <Lock className="size-5 text-teal-600" /> : <Maximize className="size-5 text-teal-600" />}
          {requiresCode ? "Enter Exam Code" : "Fullscreen Required"}
        </DialogTitle>
        <DialogDescription>{phase === "code" ? "Please enter the exam code provided by your instructor to access the exam." : "Confirm fullscreen access before your attempt is created."}</DialogDescription>
      </DialogHeader>
      {phase === "code" ? <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exam-code">Exam Code</Label>
          <Input id="exam-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verify(); } }} className="uppercase" disabled={working} />
          {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" />{error}</p>}
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Enter the code supplied by your instructor. It is verified before an attempt is started.</div>
        <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={close} disabled={working}>Cancel</Button><Button className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => void verify()} disabled={working}>{working ? "Verifying..." : "Verify & Enter"}</Button></div>
      </div> : <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center"><Maximize className="mx-auto mb-3 size-8 text-teal-700" /><p className="font-medium text-teal-900">This exam requires fullscreen mode.</p><p className="mt-2 text-sm text-teal-800">Leaving fullscreen will be recorded as a violation.</p></div>
        {error && <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" />{error}</p>}
        <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => requiresCode ? setPhase("code") : close()} disabled={working}>{requiresCode ? "Back" : "Cancel"}</Button><Button className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600" onClick={() => void startInFullscreen()} disabled={working}>{working ? "Starting..." : "Enter Fullscreen & Start Exam"}</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
