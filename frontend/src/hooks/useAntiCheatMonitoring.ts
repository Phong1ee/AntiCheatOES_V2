import { useCallback, useEffect, useRef } from "react";
import { attemptSessionStorage } from "../services/attempt-session.storage";
import { studentExamService, type AntiCheatEventResult } from "../services/student-exam.service";

type EventType = "TAB_HIDDEN" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT" | "PRINT_ATTEMPT" | "BLOCKED_SHORTCUT" | "CAMERA_TRACK_MUTED" | "CAMERA_TRACK_ENDED" | "MIC_TRACK_MUTED" | "MIC_TRACK_ENDED";

interface Options {
  active: boolean; examId: string; attemptId: number | null; mediaStream?: MediaStream;
  onEvent: (event: AntiCheatEventResult, eventType: string) => void;
  onFullscreenLost: () => void; onMediaProblem: () => void;
}

export function useAntiCheatMonitoring({ active, examId, attemptId, mediaStream, onEvent, onFullscreenLost, onMediaProblem }: Options) {
  const lastSent = useRef(new Map<string, number>());
  const unloading = useRef(false);
  const send = useCallback(async (eventType: EventType, source: "browser" | "camera" | "microphone") => {
    if (!active || !attemptId || unloading.current) return;
    const now = Date.now();
    if (now - (lastSent.current.get(eventType) ?? 0) < 1000) return;
    lastSent.current.set(eventType, now);
    try { onEvent(await studentExamService.recordAntiCheatEvent(examId, attemptId, eventType, source), eventType); } catch { /* Session failures are handled by the existing save/heartbeat gate. */ }
  }, [active, attemptId, examId, onEvent]);

  useEffect(() => {
    if (!active || !attemptId) return;
    const onVisibility = () => { if (document.hidden) void send("TAB_HIDDEN", "browser"); };
    const onBlur = () => void send("WINDOW_BLUR", "browser");
    const onFullscreen = () => { if (!document.fullscreenElement && !unloading.current) { onFullscreenLost(); void send("FULLSCREEN_EXIT", "browser"); } };
    const clipboard = (type: "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT") => (event: ClipboardEvent) => { event.preventDefault(); void send(type, "browser"); };
    const onCopy = clipboard("COPY_ATTEMPT"); const onPaste = clipboard("PASTE_ATTEMPT"); const onCut = clipboard("CUT_ATTEMPT");
    const onPrint = (event: Event) => { event.preventDefault(); void send("PRINT_ATTEMPT", "browser"); };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "f5" || ((event.ctrlKey || event.metaKey) && key === "r")) { attemptSessionStorage.markPendingRefresh(attemptId); return; }
      if ((event.ctrlKey || event.metaKey) && key === "p") { event.preventDefault(); void send("PRINT_ATTEMPT", "browser"); }
      else if (event.key === "F12") { event.preventDefault(); void send("BLOCKED_SHORTCUT", "browser"); }
    };
    const onPageHide = () => { unloading.current = true; attemptSessionStorage.markPendingRefresh(attemptId); };
    document.addEventListener("visibilitychange", onVisibility); window.addEventListener("blur", onBlur); document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy); document.addEventListener("paste", onPaste); document.addEventListener("cut", onCut);
    window.addEventListener("beforeprint", onPrint); window.addEventListener("keydown", onKeyDown); window.addEventListener("pagehide", onPageHide);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("blur", onBlur); document.removeEventListener("fullscreenchange", onFullscreen); document.removeEventListener("copy", onCopy); document.removeEventListener("paste", onPaste); document.removeEventListener("cut", onCut); window.removeEventListener("beforeprint", onPrint); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("pagehide", onPageHide); };
  }, [active, attemptId, onFullscreenLost, send]);

  useEffect(() => {
    if (!active || !mediaStream) return;
    const listeners: Array<[MediaStreamTrack, "ended" | "mute", () => void]> = [];
    for (const track of mediaStream.getTracks()) {
      const isCamera = track.kind === "video";
      const ended = () => { onMediaProblem(); void send(isCamera ? "CAMERA_TRACK_ENDED" : "MIC_TRACK_ENDED", isCamera ? "camera" : "microphone"); };
      const muted = () => { onMediaProblem(); void send(isCamera ? "CAMERA_TRACK_MUTED" : "MIC_TRACK_MUTED", isCamera ? "camera" : "microphone"); };
      track.addEventListener("ended", ended); track.addEventListener("mute", muted); listeners.push([track, "ended", ended], [track, "mute", muted]);
    }
    const deviceChange = () => { if (mediaStream.getTracks().some((track) => track.readyState !== "live")) onMediaProblem(); };
    navigator.mediaDevices?.addEventListener?.("devicechange", deviceChange);
    return () => { listeners.forEach(([track, type, listener]) => track.removeEventListener(type, listener)); navigator.mediaDevices?.removeEventListener?.("devicechange", deviceChange); };
  }, [active, mediaStream, onMediaProblem, send]);
}
