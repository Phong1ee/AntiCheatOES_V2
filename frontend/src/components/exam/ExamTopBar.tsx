import { Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ExamTopBarProps {
  examTitle: string;
  timeRemaining: number;
  onSubmit: () => void;
  warnings: number;
}

export function ExamTopBar({ examTitle, timeRemaining, onSubmit, warnings }: ExamTopBarProps) {
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  const isLowTime = timeRemaining < 5 * 60; // Less than 5 minutes

  return (
    <div className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl text-gray-800">{examTitle}</h1>
          {warnings > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <AlertTriangle className="size-4 text-red-600" />
              <span className="text-sm text-red-600">Warnings: {warnings}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isLowTime
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            <Clock className="size-5" />
            <span className="font-mono text-lg">
              {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
              {String(seconds).padStart(2, '0')}
            </span>
          </div>

          <Button
            onClick={onSubmit}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg"
          >
            Submit Exam
          </Button>
        </div>
      </div>
    </div>
  );
}
