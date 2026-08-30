import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Calendar,
  FileText,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import type { StudentExamListItem } from '../../services/student-exam.service';

interface ExamDetailsDialogProps {
  exam: StudentExamListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterExam: () => void;
  onRequestCode?: () => void;
}

const statusConfig = {
  upcoming: { label: 'Upcoming', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  open: { label: 'Open Now', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700 hover:bg-slate-100' },
};

export function ExamDetailsDialog({ exam, open, onOpenChange, onEnterExam, onRequestCode }: ExamDetailsDialogProps) {
  if (!exam) return null;

  const canEnterExam = exam.status === 'open';
  const formatDateTime = (value?: string) => {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[66vw] max-w-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{exam.title}</DialogTitle>
            </div>
            <Badge className={statusConfig[exam.status].className}>
              {statusConfig[exam.status].label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Basic Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-teal-600" />
              <span className="text-gray-800">Subject: {exam.subject}</span>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="size-5 text-teal-600" />
              Exam Information
            </h3>
            <div className="ml-7 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">
                  Starts: {formatDateTime(exam.startTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Ends: {formatDateTime(exam.endTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Duration: {exam.durationMinutes} min</span>
              </div>
            </div>
          </div>

          {exam.antiCheatEnabled && <>
            <div className="border-t pt-6">
              <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="size-5 text-teal-600" />
                Technical Requirements
              </h3>
              <div className="ml-7 space-y-2.5">
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Camera Required (Must be enabled during exam)</span></div>
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Microphone Required (For proctoring purposes)</span></div>
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Fullscreen Mode (Mandatory throughout the exam)</span></div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2"><FileText className="size-5 text-teal-600" />Pre-Exam Checklist</h3>
              <div className="ml-7 space-y-2.5">
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Check camera (Ensure it's working)</span></div>
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Test microphone (Check audio quality)</span></div>
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Stable internet (Minimum 5 Mbps)</span></div>
                <div className="flex items-center gap-2"><span className="text-teal-600">+</span><span className="text-gray-800">Close other apps (Avoid distractions)</span></div>
              </div>
            </div>
          </>}

          {/* Action Buttons */}
          {canEnterExam && (
            <div className="border-t pt-6">
              <Button
                className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg"
                onClick={onRequestCode || onEnterExam}
              >
                Enter Exam
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
