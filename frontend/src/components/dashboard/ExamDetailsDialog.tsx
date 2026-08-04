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
  User,
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
  const startDate = exam.startTime ? new Date(exam.startTime) : null;
  const hasStartDate = startDate && !Number.isNaN(startDate.getTime());
  const displayDate = hasStartDate ? startDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }) : 'Date unavailable';
  const displayTime = hasStartDate ? startDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  }) : 'Time unavailable';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[66vw] max-w-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
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
                  Date: {displayDate}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Time: {displayTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Duration: {exam.durationMinutes} min</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle className="size-5 text-teal-600" />
              Technical Requirements
            </h3>
            <div className="ml-7 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Camera Required (Must be enabled during exam)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Microphone Required (For proctoring purposes)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Fullscreen Mode (Mandatory throughout the exam)</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <User className="size-5 text-teal-600" />
              Participation Requirements
            </h3>
            <div className="ml-7 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Valid Student ID (Must be verified before starting)</span>
              </div>
              {exam.examCode !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-teal-600">+</span>
                  <span className="text-gray-800">Exam Code (Provided by your instructor)</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="size-5 text-teal-600" />
              Pre-Exam Checklist
            </h3>
            <div className="ml-7 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Check camera (Ensure it's working)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Test microphone (Check audio quality)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Stable internet (Minimum 5 Mbps)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Close other apps (Avoid distractions)</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="size-5 text-teal-600" />
              Quick Instructions
            </h3>
            <div className="ml-7 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Do not refresh the page during exam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Stay in fullscreen mode</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Answers are auto-saved every 30 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-teal-600">+</span>
                <span className="text-gray-800">Submit before time runs out</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-600" />
              Instructor Notes
            </h3>
            <div className="ml-7">
              <p className="text-gray-700 leading-relaxed">
                Please ensure you have reviewed all chapter materials (1-5) before the exam. 
                The exam will focus on SQL queries, database normalization, and ER diagrams. 
                Make sure to arrive 10 minutes early to complete the system check.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-6 flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => alert('System check started (Demo)')}
            >
              System Check
            </Button>
            
            {canEnterExam && (
              <Button
                className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg"
                onClick={onRequestCode || onEnterExam}
              >
                Enter Exam
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
