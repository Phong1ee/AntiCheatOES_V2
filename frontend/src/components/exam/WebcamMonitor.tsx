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