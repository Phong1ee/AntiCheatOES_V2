<<<<<<< Updated upstream
import { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Minimize2, Maximize2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner@2.0.3';

export function WebcamMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let mounted = true;
=======
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, CameraOff, Mic, MicOff, Radio } from "lucide-react";

type VisionStatus = "idle" | "loading" | "monitoring" | "unavailable";
type AudioStatus = "idle" | "calibrating" | "monitoring" | "unavailable";
type MonitoringStatus = "monitoring" | "starting" | "recovery" | "security-error";

const visionLabel = (status: VisionStatus) => status === "monitoring" ? "VISION READY" : status === "unavailable" ? "VISION ERROR" : "VISION LOADING";
const audioLabel = (status: AudioStatus) => status === "monitoring" ? "AUDIO READY" : status === "unavailable" ? "AUDIO ERROR" : "AUDIO CALIBRATING";
const monitoringLabel: Record<MonitoringStatus, string> = { monitoring: "MONITORING", starting: "STARTING", recovery: "RECOVERY REQUIRED", "security-error": "SECURITY ERROR" };

export function WebcamMonitor({ stream, cameraLive, microphoneLive, monitoringStatus, visionStatus, audioStatus }: { stream?: MediaStream; cameraLive: boolean; microphoneLive: boolean; monitoringStatus: MonitoringStatus; visionStatus: VisionStatus; audioStatus: AudioStatus }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => ({ x: 24, y: Math.max(112, window.innerHeight - 150) }));
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
    void videoRef.current.play().catch(() => {
      // Autoplay may wait for the browser after a stream replacement.
    });
  }, [cameraLive, stream]);
>>>>>>> Stashed changes

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (mounted) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setIsRecording(true);
          setCameraError(false);
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        if (mounted) {
          setCameraError(true);
          toast.error('Camera access denied. Please enable camera to continue the exam.');
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      className={`fixed bottom-6 left-6 z-40 transition-all duration-300 ${
        isMinimized ? 'w-12 h-12' : 'w-56 h-40'
      }`}
    >
<<<<<<< Updated upstream
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-teal-500 overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-blue-600 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cameraError ? (
              <CameraOff className="size-4 text-white" />
            ) : (
              <Camera className="size-4 text-white" />
            )}
            {!isMinimized && (
              <span className="text-xs text-white">
                {cameraError ? 'Camera Disabled' : 'Monitoring'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isMinimized && isRecording && (
              <div className="flex items-center gap-1">
                <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-white">REC</span>
              </div>
            )}
            <button
              onClick={toggleMinimize}
              className="text-white hover:bg-white/20 p-1 rounded transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="size-3" />
              ) : (
                <Minimize2 className="size-3" />
              )}
            </button>
          </div>
        </div>

        {/* Video Area */}
        {!isMinimized && (
          <div className="flex-1 bg-gray-900 relative">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="size-8 text-red-400 mb-2" />
                <p className="text-xs text-gray-300">Camera access required</p>
                <p className="text-xs text-gray-400 mt-1">
                  Please enable camera permissions
                </p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                    <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs text-white">Recording</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Minimized Icon */}
        {isMinimized && (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-teal-100 to-blue-100">
            {cameraError ? (
              <CameraOff className="size-6 text-teal-700" />
            ) : (
              <div className="relative">
                <Camera className="size-6 text-teal-700" />
                {isRecording && (
                  <div className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
          </div>
        )}
=======
      <div className="relative h-full overflow-hidden rounded-xl bg-slate-950 shadow-lg">
        {cameraLive ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><CameraOff className="size-6" /></div>}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 text-[10px] text-white">
          <span className="flex items-center gap-1 rounded bg-black/55 px-1.5 py-1">{cameraLive ? <Camera className="size-3" /> : <CameraOff className="size-3" />}{cameraLive ? "CAM LIVE" : "CAM OFF"}</span>
          <span className="flex items-center gap-1 rounded bg-black/55 px-1.5 py-1">{microphoneLive ? <Mic className="size-3" /> : <MicOff className="size-3" />}{microphoneLive ? "MIC LIVE" : "MIC OFF"}</span>
          <span className={`flex items-center gap-1 rounded px-1.5 py-1 ${monitoringStatus === "monitoring" ? "bg-emerald-600/85" : monitoringStatus === "security-error" ? "bg-red-700/85" : "bg-amber-600/85"}`}><Radio className="size-3" />{monitoringLabel[monitoringStatus]}</span>
        </div>
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] gap-1 text-[9px] text-white">
          <span className={`truncate rounded px-1.5 py-1 ${visionStatus === "unavailable" ? "bg-red-700/85" : "bg-black/55"}`}>{visionLabel(visionStatus)}</span>
          <span className={`truncate rounded px-1.5 py-1 ${audioStatus === "unavailable" ? "bg-red-700/85" : "bg-black/55"}`}>{audioLabel(audioStatus)}</span>
        </div>
>>>>>>> Stashed changes
      </div>

      {/* Warning tooltip when minimized and camera error */}
      {isMinimized && cameraError && (
        <div className="absolute bottom-full right-0 mb-2 bg-red-500 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
          Camera required for exam
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
        </div>
      )}
    </div>
  );
}