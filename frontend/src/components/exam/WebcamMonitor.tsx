import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CameraOff, Mic, MicOff } from "lucide-react";

export function WebcamMonitor({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => ({ x: 24, y: Math.max(112, window.innerHeight - 150) }));
  const [dragging, setDragging] = useState(false);
  const cameraLive = stream.getVideoTracks().some((track) => track.readyState === "live");
  const microphoneLive = stream.getAudioTracks().some((track) => track.readyState === "live");

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y };
    setDragging(true);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const width = 216;
    const height = 126;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragOffset.current.y)),
    });
  };

  return (
    <div
      className={`fixed z-40 select-none touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ left: position.x, top: position.y, width: 216, height: 126 }}
      onPointerDown={beginDrag}
      onPointerMove={drag}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="relative h-full overflow-hidden rounded-xl bg-slate-950 shadow-lg">
        {cameraLive ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><CameraOff className="size-6" /></div>}
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-1 text-[10px] text-white">
          {microphoneLive ? <Mic className="size-3" /> : <MicOff className="size-3" />}
          {microphoneLive ? "LIVE" : "MIC OFF"}
        </span>
      </div>
    </div>
  );
}
