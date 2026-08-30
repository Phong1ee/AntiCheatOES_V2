import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Maximize, Mic, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { MICROPHONE_CAPTURE_PROFILE } from "../../anti-cheat/microphone-ai.config";
import { preflightAntiCheatRuntime, startSecuredAttempt } from "../../anti-cheat/anti-cheat-lifecycle";
import type { AntiCheatRuntime } from "../../anti-cheat/anti-cheat-runtime";
import { requestFullscreenOrThrow } from "../../utils/fullscreen";

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
        requestFullscreen: requestFullscreenOrThrow,
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
    <DialogContent className="oes-dialog-rounded max-w-xl gap-0 p-0">
      <div className="rounded-t-2xl border-b border-teal-100 bg-gradient-to-br from-teal-50 via-white to-blue-50 px-6 pt-6 pb-5 pr-10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <ShieldCheck className="size-4.5" />
            </span>
            Rules & Security
          </DialogTitle>
          <DialogDescription>{examTitle}</DialogDescription>
        </DialogHeader>
      </div>
      <div className="space-y-4 px-6 pt-5 pb-6">
        <ul className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-700">
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" />Stay in fullscreen and do not switch tabs, windows, or minimize the browser.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" />Copy, paste, cut, print, and blocked shortcuts are recorded.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" />Camera and microphone must remain active. Refreshing is recorded when resumed.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" />Sit in a well-lit, quiet place so camera and microphone monitoring can work reliably.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" />Use the same browser profile throughout this attempt. Switching browsers or browser profiles during an active exam is not allowed.</li>
        </ul>
        <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          All violations share one limit of <strong className="mx-1">{violationLimit}</strong>. Reaching it ends this attempt with 0 points.
        </p>
        {stream && <div className="grid grid-cols-1 gap-4 rounded-xl border border-teal-200 bg-teal-50/40 p-3 sm:grid-cols-[13.5rem_1fr]"><video ref={videoRef} autoPlay playsInline muted style={{ aspectRatio: cameraAspectRatio }} className="w-[216px] max-w-full rounded-lg bg-slate-900 object-contain" /><div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-emerald-700"><Camera className="size-4" />Camera ready</p><p className="flex items-center gap-2 text-emerald-700"><Mic className="size-4" />Microphone ready</p><p className="text-xs text-slate-500">Live monitoring only. No media is recorded or uploaded.</p></div></div>}
        {error && <p className="flex gap-2 text-sm text-red-600"><AlertCircle className="size-4 shrink-0" />{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={close} disabled={working}>Cancel</Button>
          {!stream
            ? <Button className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-sm hover:from-teal-600 hover:to-blue-700" onClick={() => void requestMedia()} disabled={working}>{working ? "Checking..." : "Take Test"}</Button>
            : <Button className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-sm hover:from-teal-600 hover:to-blue-700" onClick={() => void continueToExam()} disabled={working}><Maximize className="mr-2 size-4" />{working ? "Starting..." : "Enter Fullscreen & Start"}</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
