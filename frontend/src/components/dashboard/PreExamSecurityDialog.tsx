import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Maximize, Mic, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { MEDIA_CAPTURE_CONSTRAINTS } from "../../config/proctoring-policy";

interface PreExamSecurityDialogProps {
  open: boolean;
  examTitle: string;
  violationLimit: number;
  onOpenChange: (open: boolean) => void;
  onReady: (stream: MediaStream, audioContext: AudioContext) => Promise<void>;
}

export function PreExamSecurityDialog({ open, examTitle, violationLimit, onOpenChange, onReady }: PreExamSecurityDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const stopStream = () => {
    ownedStreamRef.current?.getTracks().forEach((track) => track.stop());
    ownedStreamRef.current = null;
    setStream(null);
  };

  useEffect(() => () => { ownedStreamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  const requestMedia = async () => {
    setError(null); setWorking(true);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia(MEDIA_CAPTURE_CONSTRAINTS);
      const cameraReady = nextStream.getVideoTracks().some((track) => track.readyState === "live");
      const microphoneReady = nextStream.getAudioTracks().some((track) => track.readyState === "live");
      if (!cameraReady || !microphoneReady) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error("A live camera and microphone are both required.");
      }
      ownedStreamRef.current = nextStream;
      setStream(nextStream);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Camera and microphone permission is required.");
    } finally { setWorking(false); }
  };

  const continueToExam = async () => {
    if (!stream) return;
    setError(null); setWorking(true);
    try {
      const audioContext = new AudioContext();
      await audioContext.resume();
      await document.documentElement.requestFullscreen();
      await onReady(stream, audioContext);
      ownedStreamRef.current = null; // Ownership transfers to Dashboard/ExamInterface after API success.
      setStream(null);
      onOpenChange(false);
    } catch (cause) {
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
      {stream && <div className="grid grid-cols-[9rem_1fr] gap-4 rounded-xl border p-3"><video ref={videoRef} autoPlay playsInline muted className="h-24 w-36 rounded-lg bg-slate-900 object-cover" /><div className="space-y-2 text-sm"><p className="flex items-center gap-2 text-emerald-700"><Camera className="size-4" />Camera ready</p><p className="flex items-center gap-2 text-emerald-700"><Mic className="size-4" />Microphone ready</p><p className="text-xs text-slate-500">Live monitoring only. No media is recorded or uploaded.</p></div></div>}
      {error && <p className="flex gap-2 text-sm text-red-600"><AlertCircle className="size-4 shrink-0" />{error}</p>}
      <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={close} disabled={working}>Cancel</Button>{!stream ? <Button className="flex-1" onClick={() => void requestMedia()} disabled={working}>{working ? "Checking..." : "Take Test"}</Button> : <Button className="flex-1" onClick={() => void continueToExam()} disabled={working}><Maximize className="mr-2 size-4" />{working ? "Starting..." : "Enter Fullscreen & Start"}</Button>}</div>
    </DialogContent>
  </Dialog>;
}
