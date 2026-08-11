import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Maximize, Mic, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { MICROPHONE_CAPTURE_PROFILE } from "../../anti-cheat/microphone-ai.config";
import { preflightAntiCheatRuntime, startSecuredAttempt } from "../../anti-cheat/anti-cheat-lifecycle";
import type { AntiCheatRuntime } from "../../anti-cheat/anti-cheat-runtime";

interface PreExamSecurityDialogProps {
  open: boolean;
  examTitle: string;
  violationLimit: number;
  onOpenChange: (open: boolean) => void;
  onReady: (stream: MediaStream, runtime: AntiCheatRuntime) => Promise<void>;
}

export function PreExamSecurityDialog({ open, examTitle, violationLimit, onOpenChange, onReady }: PreExamSecurityDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const preflightRuntimeRef = useRef<AntiCheatRuntime | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [cameraAspectRatio, setCameraAspectRatio] = useState(16 / 9);

  const stopStream = () => {
    preflightRuntimeRef.current?.stop();
    preflightRuntimeRef.current = null;
    ownedStreamRef.current?.getTracks().forEach((track) => track.stop());
    ownedStreamRef.current = null;
    setStream(null);
  };

  useEffect(() => () => {
    preflightRuntimeRef.current?.stop();
    ownedStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!stream) return;
    if (videoRef.current) videoRef.current.srcObject = stream;
    const settings = stream.getVideoTracks()[0]?.getSettings();
    const aspectRatio = settings?.aspectRatio ?? (settings?.width && settings?.height ? settings.width / settings.height : undefined);
    setCameraAspectRatio(aspectRatio && Number.isFinite(aspectRatio) ? aspectRatio : 16 / 9);
  }, [stream]);

  const requestMedia = async () => {
    setError(null); setWorking(true);
    let nextStream: MediaStream | null = null;
    try {
      const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
      const videoConstraints: MediaTrackConstraints = {};

      // Let each camera provide its native frame; do not force a mode that can crop it.
      if (supportedConstraints.facingMode) videoConstraints.facingMode = { ideal: "user" };
      if (supportedConstraints.resizeMode) videoConstraints.resizeMode = { ideal: "none" };
      if (supportedConstraints.width) videoConstraints.width = { ideal: 640 };
      if (supportedConstraints.height) videoConstraints.height = { ideal: 480 };
      if (supportedConstraints.frameRate) videoConstraints.frameRate = { ideal: 15 };

      const audioConstraints: MediaTrackConstraints = {};
      // Preserve background speech for overlap analysis. The echo-only fallback
      // remains opt-in in microphone-ai.config.ts after hardware verification.
      if (supportedConstraints.echoCancellation) audioConstraints.echoCancellation = MICROPHONE_CAPTURE_PROFILE.echoCancellation;
      if (supportedConstraints.noiseSuppression) audioConstraints.noiseSuppression = MICROPHONE_CAPTURE_PROFILE.noiseSuppression;
      if (supportedConstraints.autoGainControl) audioConstraints.autoGainControl = MICROPHONE_CAPTURE_PROFILE.autoGainControl;
      nextStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
      const cameraReady = nextStream.getVideoTracks().some((track) => track.readyState === "live");
      const microphoneReady = nextStream.getAudioTracks().some((track) => track.readyState === "live");
      if (!cameraReady || !microphoneReady) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error("A live camera and microphone are both required.");
      }
      if (import.meta.env.DEV) {
        const settings = nextStream.getAudioTracks()[0]?.getSettings();
        console.debug('[AntiCheat microphone]', {
          echoCancellation: settings?.echoCancellation,
          noiseSuppression: settings?.noiseSuppression,
          autoGainControl: settings?.autoGainControl,
          sampleRate: settings?.sampleRate,
          channelCount: settings?.channelCount,
        });
      }
      ownedStreamRef.current = nextStream;
      setStream(nextStream);
    } catch (cause) {
      nextStream?.getTracks().forEach((track) => track.stop());
      setError(cause instanceof Error ? cause.message : "Camera and microphone permission is required.");
    } finally { setWorking(false); }
  };

  const continueToExam = async () => {
    if (!stream) return;
    setError(null); setWorking(true);
    try {
      const runtime = await startSecuredAttempt({
        // This initializes the actual MediaPipe, Silero, and Pyannote sessions,
        // not merely their model URLs. The live runtime transfers into the exam.
        preflight: () => preflightAntiCheatRuntime(stream),
        requestFullscreen: () => document.documentElement.requestFullscreen(),
        startAttempt: (preparedRuntime) => onReady(stream, preparedRuntime),
      });
      preflightRuntimeRef.current = runtime;
      ownedStreamRef.current = null; // Ownership transfers to Dashboard/ExamInterface after API success.
      preflightRuntimeRef.current = null;
      setStream(null);
      onOpenChange(false);
    } catch (cause) {
      preflightRuntimeRef.current?.stop();
      preflightRuntimeRef.current = null;
      if (document.fullscreenElement) await document.exitFullscreen();
      setError(cause instanceof Error ? cause.message : "Unable to start the secure exam session.");
    } finally { setWorking(false); }
  };

  const close = () => { stopStream(); onOpenChange(false); };
  const cameraReady = Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live"));
  const microphoneReady = Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live"));

  return <Dialog open={open} onOpenChange={(next) => !next && close()}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-teal-600" />Rules & Security</DialogTitle><DialogDescription>{examTitle}</DialogDescription></DialogHeader>
      <ul className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-5 text-slate-700">
        <li>Stay in fullscreen and do not switch tabs, windows, or minimize the browser.</li>
        <li>Copy, paste, cut, print, and blocked shortcuts are recorded.</li>
        <li>Camera and microphone must remain active. Refreshing is recorded when resumed.</li>
        <li>All violations share one limit of <strong>{violationLimit}</strong>. Reaching it ends this attempt with 0 points.</li>
      </ul>
      {stream && <div className="grid grid-cols-1 gap-4 rounded-xl border p-3 sm:grid-cols-[13.5rem_1fr]"><video ref={videoRef} autoPlay playsInline muted style={{ aspectRatio: cameraAspectRatio }} className="w-[216px] max-w-full rounded-lg bg-slate-900 object-contain" /><div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-emerald-700"><Camera className="size-4" />Camera ready</p><p className="flex items-center gap-2 text-emerald-700"><Mic className="size-4" />Microphone ready</p><p className="text-xs text-slate-500">Live monitoring only. No media is recorded or uploaded.</p></div></div>}
      {error && <p className="flex gap-2 text-sm text-red-600"><AlertCircle className="size-4 shrink-0" />{error}</p>}
      <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={close} disabled={working}>Cancel</Button>{!stream ? <Button className="flex-1" onClick={() => void requestMedia()} disabled={working}>{working ? "Checking..." : "Take Test"}</Button> : <Button className="flex-1" onClick={() => void continueToExam()} disabled={working}><Maximize className="mr-2 size-4" />{working ? "Starting..." : "Enter Fullscreen & Start"}</Button>}</div>
    </DialogContent>
  </Dialog>;
}
