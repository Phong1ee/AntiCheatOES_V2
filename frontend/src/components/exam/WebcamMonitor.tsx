import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, Minimize2, Maximize2 } from "lucide-react";

export function WebcamMonitor({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const cameraLive = stream.getVideoTracks().some((track) => track.readyState === "live");
  const microphoneLive = stream.getAudioTracks().some((track) => track.readyState === "live");

  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  return <div className={`fixed bottom-6 left-6 z-40 transition-all duration-300 ${isMinimized ? "h-12 w-12" : "h-40 w-56"}`}>
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-teal-500 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-teal-500 to-blue-600 px-3 py-2 text-white">
        <span className="flex items-center gap-2 text-xs">{cameraLive ? <Camera className="size-4" /> : <CameraOff className="size-4" />}{!isMinimized && (cameraLive ? "LIVE" : "Camera unavailable")}</span>
        <button onClick={() => setIsMinimized((value) => !value)} className="rounded p-1 hover:bg-white/20">{isMinimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}</button>
      </div>
      {!isMinimized ? <div className="relative flex-1 bg-slate-900"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /><span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white"><Mic className="size-3" />{microphoneLive ? "Mic live" : "Mic unavailable"}</span></div> : <div className="flex flex-1 items-center justify-center bg-teal-50"><Camera className="size-6 text-teal-700" /></div>}
    </div>
  </div>;
}
