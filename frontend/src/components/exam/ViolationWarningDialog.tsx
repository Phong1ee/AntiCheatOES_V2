import { useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "../ui/button";

export function ViolationWarningDialog({ open, onOpenChange, eventType, violationCount, violationLimit, remainingViolations, terminated, onReturnToFullscreen, onTerminatedExit, error }: {
  open: boolean; onOpenChange: (open: boolean) => void; eventType?: string; violationCount: number; violationLimit: number; remainingViolations: number | null; terminated: boolean; onReturnToFullscreen?: () => void; onTerminatedExit?: () => void;
  /** Why the last "Return to Fullscreen" attempt failed; this dialog is the only surface left for it. */
  error?: string | null;
}) {
  const labels: Record<string, string> = { MULTIPLE_VOICES_DETECTED: "Multiple voices were detected." };
  const label = labels[eventType ?? ""] || eventType?.replaceAll("_", " ").toLowerCase() || "Anti-cheat event";
  const finalWarning = !terminated && violationCount === violationLimit - 1;
  const message = terminated ? "Violation limit reached. This attempt was ended and scored 0." : `${label.charAt(0).toUpperCase()}${label.slice(1)}${label.endsWith(".") ? "" : " recorded."} Violations: ${violationCount}/${violationLimit}.${finalWarning ? " This is the last warning." : remainingViolations !== null ? ` ${remainingViolations} remaining.` : ""}`;
  // Safety net for a Radix cleanup raced by the fullscreen transition this dialog
  // is reacting to: a stuck pointer-events:none on <body> leaves the exam
  // unclickable. This has to be an effect on `open`, not part of onOpenChange -
  // the dialog is normally closed by state (returning to fullscreen), so Radix
  // never reports that close and the old handler never ran on the real path.
  useEffect(() => {
    if (open) return undefined;
    const timer = window.setTimeout(() => {
      // Another dialog may legitimately hold the lock; only clear an orphan.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      document.body.style.pointerEvents = '';
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);
  // Escape is also what exits browser fullscreen; letting Radix's default Escape
  // handler close this dialog too races that fullscreen transition and can leave
  // the page's overlay lock (pointer-events/aria-hidden) stuck after repeated exits.
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2">{terminated ? <XCircle className="text-red-600" /> : <AlertTriangle className="text-amber-600" />}{terminated ? "Attempt Terminated" : finalWarning ? "Final Warning" : "Violation Recorded"}</AlertDialogTitle><AlertDialogDescription>{message}</AlertDialogDescription></AlertDialogHeader>{error && <p className="text-sm text-red-600">{error}</p>}<AlertDialogFooter>{onReturnToFullscreen && !terminated ? <Button onClick={onReturnToFullscreen}>Return to Fullscreen</Button> : <AlertDialogAction onClick={() => { onOpenChange(false); if (terminated) onTerminatedExit?.(); }}>{terminated ? "Back to Dashboard" : "Continue"}</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
