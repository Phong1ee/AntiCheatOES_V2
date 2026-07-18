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
}
