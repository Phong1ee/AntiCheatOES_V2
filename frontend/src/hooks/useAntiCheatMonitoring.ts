import { useCallback, useEffect, useRef } from "react";
import { attemptSessionStorage } from "../services/attempt-session.storage";
import { isChargeableViolation, isFullscreenExitReportable } from "../anti-cheat/anti-cheat-lifecycle";
import type { IncidentReporter } from "../anti-cheat/incident-reporter";

type EventType = "TAB_HIDDEN" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT" | "PRINT_ATTEMPT" | "BLOCKED_SHORTCUT" | "CAMERA_TRACK_MUTED" | "CAMERA_TRACK_ENDED" | "MIC_TRACK_MUTED" | "MIC_TRACK_ENDED";

interface Options {
  active: boolean; examId: string; attemptId: number | null; mediaStream?: MediaStream;
  reporter: IncidentReporter;
  shouldIgnoreEvents: () => boolean;
  onFullscreenLost: () => void; onMediaProblem: () => void;
}

export function useAntiCheatMonitoring({ active, examId, attemptId, mediaStream, reporter, shouldIgnoreEvents, onFullscreenLost, onMediaProblem }: Options) {
  // A browser action can fire blur, visibility, and fullscreen events together.
  // Count only the first event in that burst so one action costs one violation.
  const lastViolationBurst = useRef(0);
  const unloading = useRef(false);
  const mediaIssueAt = useRef(new Map<MediaStreamTrack, number>());
  // Whether fullscreen was actually held, so leaving it is a distinct user act.
  const heldFullscreen = useRef(false);

  useEffect(() => {
    if (!active) {
      unloading.current = false;
      lastViolationBurst.current = 0;
      heldFullscreen.current = false;
      mediaIssueAt.current.clear();
    }
  }, [active, attemptId]);

  const { report } = reporter;
  const send = useCallback(async (eventType: EventType, source: "browser" | "camera" | "microphone", ownAction = false) => {
    if (!active || !attemptId || unloading.current || shouldIgnoreEvents()) return;
    const now = Date.now();
    if (!isChargeableViolation(now, lastViolationBurst.current, ownAction)) return;
    lastViolationBurst.current = now;
    await report({ eventType, source });
  }, [active, attemptId, report, shouldIgnoreEvents]);

  useEffect(() => {
    if (!active || !attemptId) return;
    heldFullscreen.current = Boolean(document.fullscreenElement);
    const onVisibility = () => { if (document.hidden) void send("TAB_HIDDEN", "browser"); };
    const onBlur = () => void send("WINDOW_BLUR", "browser");
    // send() applies shouldIgnoreEvents() itself, but the lock must honour it
    // too - otherwise an exam-ending exit records no violation yet still gates
    // the student behind the security screen.
    const onFullscreen = () => {
      if (document.fullscreenElement) { heldFullscreen.current = true; return; }
      if (!isFullscreenExitReportable(false, unloading.current, shouldIgnoreEvents())) return;
      // Giving up fullscreen we were holding is always the student's own act, so
      // it is charged however fast they cycle out and back in.
      const ownAction = heldFullscreen.current;
      heldFullscreen.current = false;
      onFullscreenLost();
      void send("FULLSCREEN_EXIT", "browser", ownAction);
    };
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
  }, [active, attemptId, onFullscreenLost, send, shouldIgnoreEvents]);

  useEffect(() => {
    if (!active || !mediaStream) return;
    const listeners: Array<[MediaStreamTrack, "ended" | "mute", () => void]> = [];
    for (const track of mediaStream.getTracks()) {
      const isCamera = track.kind === "video";
      const reportPhysicalIssue = (eventType: EventType) => {
        const now = Date.now();
        const previousIssue = mediaIssueAt.current.get(track) ?? 0;
        // A mute often precedes an ended event for the same physical failure.
        if (now - previousIssue < 2_500) return;
        mediaIssueAt.current.set(track, now);
        onMediaProblem();
        void send(eventType, isCamera ? "camera" : "microphone");
      };
      const ended = () => reportPhysicalIssue(isCamera ? "CAMERA_TRACK_ENDED" : "MIC_TRACK_ENDED");
      const muted = () => reportPhysicalIssue(isCamera ? "CAMERA_TRACK_MUTED" : "MIC_TRACK_MUTED");
      track.addEventListener("ended", ended); track.addEventListener("mute", muted); listeners.push([track, "ended", ended], [track, "mute", muted]);
    }
    // Device changes are diagnostic only. Track events provide the one authoritative incident.
    const deviceChange = () => { if (mediaStream.getTracks().some((track) => track.readyState !== "live")) onMediaProblem(); };
    navigator.mediaDevices?.addEventListener?.("devicechange", deviceChange);
    return () => { listeners.forEach(([track, type, listener]) => track.removeEventListener(type, listener)); navigator.mediaDevices?.removeEventListener?.("devicechange", deviceChange); };
  }, [active, mediaStream, onMediaProblem, send]);
}
