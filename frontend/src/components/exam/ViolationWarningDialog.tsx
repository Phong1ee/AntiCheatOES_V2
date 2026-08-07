import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle, XCircle } from 'lucide-react';

<<<<<<< Updated upstream
interface ViolationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  violationType: 'copy-paste' | 'tab-switch' | 'fullscreen-exit' | 'final';
  violationCount: number;
  threshold?: number;
}

export function ViolationWarningDialog({
  open,
  onOpenChange,
  violationType,
  violationCount,
  threshold = 3,
}: ViolationWarningDialogProps) {
  const isFinalWarning = violationCount >= threshold - 1;
  const isTermination = violationType === 'final';

  const getTitle = () => {
    if (isTermination) {
      return 'Exam Terminated';
    }
    if (isFinalWarning) {
      return 'Final Warning';
    }
    return 'Violation Detected';
  };

  const getMessage = () => {
    if (isTermination) {
      return 'Your exam has been automatically submitted due to multiple violations. You have been returned to the exam list.';
    }

    if (violationType === 'copy-paste') {
      if (isFinalWarning) {
        return `You have attempted to copy/paste content. This is your FINAL WARNING (${violationCount}/${threshold} violations). One more violation will result in automatic exam termination.`;
      }
      return `Warning: Copy/paste actions are not allowed during the exam. This violation has been recorded (${violationCount}/${threshold}).`;
    }

    if (violationType === 'tab-switch') {
      if (isFinalWarning) {
        return `You have switched tabs or minimized the window. This is your FINAL WARNING (${violationCount}/${threshold} violations). One more violation will result in automatic exam termination.`;
      }
      return `Warning: Switching tabs or leaving the exam window is not allowed. This violation has been recorded (${violationCount}/${threshold}).`;
    }

    if (violationType === 'fullscreen-exit') {
      if (isFinalWarning) {
        return `You have exited fullscreen mode. This is your FINAL WARNING (${violationCount}/${threshold} violations). One more violation will result in automatic exam termination.`;
      }
      return `Warning: Exiting fullscreen mode is not allowed during the exam. This violation has been recorded (${violationCount}/${threshold}).`;
    }

    return 'A violation has been detected and recorded.';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {isTermination ? (
              <div className="p-3 bg-red-100 rounded-full">
                <XCircle className="size-6 text-red-600" />
              </div>
            ) : (
              <div
                className={`p-3 rounded-full ${
                  isFinalWarning ? 'bg-red-100' : 'bg-amber-100'
                }`}
              >
                <AlertTriangle
                  className={`size-6 ${
                    isFinalWarning ? 'text-red-600' : 'text-amber-600'
                  }`}
                />
              </div>
            )}
            <AlertDialogTitle className={isTermination ? 'text-red-700' : ''}>
              {getTitle()}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-700">
            {getMessage()}
          </AlertDialogDescription>

          {!isTermination && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700 mb-2">Reminder:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Do not copy or paste content</li>
                <li>• Stay in fullscreen mode</li>
                <li>• Do not switch tabs or windows</li>
                <li>• Keep your focus on the exam</li>
              </ul>
            </div>
          )}

          {isFinalWarning && !isTermination && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ This is your last warning. Any further violation will terminate your
                exam immediately.
              </p>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => onOpenChange(false)}
            className={
              isTermination
                ? 'bg-red-600 hover:bg-red-700'
                : isFinalWarning
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700'
            }
          >
            {isTermination ? 'Understood' : isFinalWarning ? 'I Understand' : 'Continue Exam'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
=======
const EVENT_MESSAGES: Record<string, string> = {
  CAMERA_PERMISSION_DENIED: "Camera permission was denied during recovery.", CAMERA_NOT_AVAILABLE: "Camera device is not available.", CAMERA_TRACK_MUTED: "Camera track remained muted for 3 seconds.", CAMERA_TRACK_ENDED: "Camera track ended.",
  MIC_PERMISSION_DENIED: "Microphone permission was denied during recovery.", MIC_NOT_AVAILABLE: "Microphone device is not available.", MIC_TRACK_MUTED: "Microphone track remained muted for 3 seconds.", MIC_TRACK_ENDED: "Microphone track ended.",
  NO_FACE_DETECTED: "No face was detected continuously for the required duration.", FACE_QUALITY_LOW: "Camera image quality remained below the required threshold.", FACE_POSITION_INVALID: "Face position remained outside the required camera framing.", UPPER_BODY_NOT_VISIBLE: "Required shoulder landmarks were not visible.", MULTIPLE_FACES_DETECTED: "More than one face was detected.", PHONE_DETECTED: "A phone-like object was detected.",
  GAZE_AWAY_SUSTAINED: "A sustained screen-facing orientation signal was observed.", HEAD_POSE_OUT_OF_RANGE: "Head orientation remained outside the configured range.", REPEATED_HEAD_MOVEMENT: "Repeated head movement was observed.",
  AUDIO_ACTIVITY_DETECTED: "Sustained audio above the calibrated background level was observed.", SPEECH_ACTIVITY_DETECTED: "Sustained speech-like audio was observed.", AUDIO_SIGNAL_DEGRADED: "Microphone signal quality was degraded.",
};

export function ViolationWarningDialog({ open, onOpenChange, eventType, violationCount, violationLimit, remainingViolations, terminated, countsTowardLimit = true, onReturnToFullscreen, onTerminatedExit }: {
  open: boolean; onOpenChange: (open: boolean) => void; eventType?: string; violationCount: number; violationLimit: number; remainingViolations: number | null; terminated: boolean; countsTowardLimit?: boolean; onReturnToFullscreen?: () => void; onTerminatedExit?: () => void;
}) {
  const reviewOnly = !countsTowardLimit;
  const label = eventType?.replaceAll("_", " ").toLowerCase() || "Anti-cheat event";
  const observation = EVENT_MESSAGES[eventType ?? ""] ?? `${label.charAt(0).toUpperCase()}${label.slice(1)} recorded.`;
  const finalWarning = !terminated && violationCount === violationLimit - 1;
  const message = terminated ? `${observation} Violation limit reached. This attempt was ended and scored 0.` : reviewOnly ? `${observation} It does not change your violation count.` : `${observation} Violations: ${violationCount}/${violationLimit}.${finalWarning ? " This is the last warning." : remainingViolations !== null ? ` ${remainingViolations} remaining.` : ""}`;
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2">{terminated ? <XCircle className="text-red-600" /> : <AlertTriangle className="text-amber-600" />}{terminated ? "Attempt Terminated" : reviewOnly ? "Monitoring Notice" : finalWarning ? "Final Warning" : "Violation Recorded"}</AlertDialogTitle><AlertDialogDescription>{message}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter>{onReturnToFullscreen && !terminated ? <Button onClick={onReturnToFullscreen}>Return to Fullscreen</Button> : <AlertDialogAction onClick={() => { onOpenChange(false); if (terminated) onTerminatedExit?.(); }}>{terminated ? "Back to Dashboard" : "Continue"}</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog>;
>>>>>>> Stashed changes
}
