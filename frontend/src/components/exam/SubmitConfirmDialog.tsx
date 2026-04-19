import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface SubmitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  answeredCount: number;
  totalQuestions: number;
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  answeredCount,
  totalQuestions,
}: SubmitConfirmDialogProps) {
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="size-6 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-xl">Submit Exam?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-3">
            <p>Are you sure you want to submit your exam? This action cannot be undone.</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Answered Questions:</span>
                <span className="text-blue-700">{answeredCount} / {totalQuestions}</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Unanswered Questions:</span>
                  <span className="text-amber-700">{unansweredCount}</span>
                </div>
              )}
            </div>

            {unansweredCount > 0 && (
              <p className="text-amber-700 text-sm">
                ⚠️ You still have {unansweredCount} unanswered question(s). 
                These will be marked as incorrect.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Review Answers</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
          >
            Yes, Submit Exam
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
