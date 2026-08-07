import { useCallback, useEffect, useRef } from "react";
import { attemptSessionStorage } from "../services/attempt-session.storage";
import { studentExamService, type AntiCheatEventResult } from "../services/student-exam.service";

type EventType = "TAB_HIDDEN" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT" | "PRINT_ATTEMPT" | "BLOCKED_SHORTCUT";

interface Options {
  active: boolean; examId: string; attemptId: number | null;
  onEvent: (event: AntiCheatEventResult, eventType: string) => void;
  onFullscreenLost: () => void;
}

export function useAntiCheatMonitoring({ active, examId, attemptId, onEvent, onFullscreenLost }: Options) {
  // Browser events share their own incident window; media health incidents are independent.
  const browserIncidentAt = useRef(0);
  const unloading = useRef(false);

  useEffect(() => {
    if (!active) {
      unloading.current = false;
      browserIncidentAt.current = 0;
    }
  }, [active, attemptId]);

  const send = useCallback(async (eventType: EventType) => {
    if (!active || !attemptId || unloading.current) return;
    const now = Date.now();
    if (now - browserIncidentAt.current < 1_500) return;
    browserIncidentAt.current = now;
    try { onEvent(await studentExamService.recordAntiCheatEvent(examId, attemptId, eventType, "browser"), eventType); } catch { /* Session failures are handled by the existing save/heartbeat gate. */ }
  }, [active, attemptId, examId, onEvent]);

  useEffect(() => {
    if (!active || !attemptId) return;
    const onVisibility = () => { if (document.hidden) void send("TAB_HIDDEN"); };
    const onBlur = () => void send("WINDOW_BLUR");
    const onFullscreen = () => { if (!document.fullscreenElement && !unloading.current) { onFullscreenLost(); void send("FULLSCREEN_EXIT"); } };
    const clipboard = (type: "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT") => (event: ClipboardEvent) => { event.preventDefault(); void send(type); };
    const onCopy = clipboard("COPY_ATTEMPT"); const onPaste = clipboard("PASTE_ATTEMPT"); const onCut = clipboard("CUT_ATTEMPT");
    const onPrint = (event: Event) => { event.preventDefault(); void send("PRINT_ATTEMPT"); };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "f5" || ((event.ctrlKey || event.metaKey) && key === "r")) { attemptSessionStorage.markPendingRefresh(attemptId); return; }
      if ((event.ctrlKey || event.metaKey) && key === "p") { event.preventDefault(); void send("PRINT_ATTEMPT"); }
      else if (event.key === "F12") { event.preventDefault(); void send("BLOCKED_SHORTCUT"); }
    };
    const onPageHide = () => { unloading.current = true; attemptSessionStorage.markPendingRefresh(attemptId); };
    document.addEventListener("visibilitychange", onVisibility); window.addEventListener("blur", onBlur); document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy); document.addEventListener("paste", onPaste); document.addEventListener("cut", onCut);
    window.addEventListener("beforeprint", onPrint); window.addEventListener("keydown", onKeyDown); window.addEventListener("pagehide", onPageHide);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("blur", onBlur); document.removeEventListener("fullscreenchange", onFullscreen); document.removeEventListener("copy", onCopy); document.removeEventListener("paste", onPaste); document.removeEventListener("cut", onCut); window.removeEventListener("beforeprint", onPrint); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("pagehide", onPageHide); };
  }, [active, attemptId, onFullscreenLost, send]);

}
