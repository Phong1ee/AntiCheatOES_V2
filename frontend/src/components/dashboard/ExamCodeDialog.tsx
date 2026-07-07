import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle, Lock } from 'lucide-react';

interface ExamCodeDialogProps {
  exam: {
    id: string;
    title: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // ✅ parent trả về true nếu code đúng, false nếu sai
  onSubmit: (code: string) => Promise<boolean>;
}

export function ExamCodeDialog({ exam, open, onOpenChange, onSubmit }: ExamCodeDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // reset khi đổi exam hoặc đóng dialog
  useEffect(() => {
    if (!open) {
      setCode('');
      setError('');
      setVerifying(false);
    }
  }, [open, exam?.id]);

  if (!exam) return null;

  const handleSubmit = async () => {
    if (verifying) return;

    const trimmed = code.trim();

    if (!trimmed) {
      setError('Please enter the exam code');
      return;
    }

    if (trimmed.length < 6) {
      setError('Exam code must be at least 6 characters');
      return;
    }

    setError('');
    setVerifying(true);

    try {
      const ok = await onSubmit(trimmed);

      if (!ok) {
        setError('Incorrect exam code. Please try again.');
        return;
      }

      // đúng code -> đóng dialog + reset
      setCode('');
      setError('');
      onOpenChange(false);
    } catch (e) {
      setError('Unable to verify exam code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCode('');
      setError('');
      setVerifying(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-teal-600" />
            Enter Exam Code
          </DialogTitle>
          <DialogDescription>
            Please enter the exam code provided by your instructor to access the exam.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="exam-code">Exam Code</Label>
            <Input
              id="exam-code"
              type="text"
              placeholder="Enter your exam code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="uppercase"
              disabled={verifying}
            />

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="size-4" />
                {error}
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Where to find your exam code?</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>View the "Exam Codes" widget on dashboard</li>
                  <li>Contact your instructor if not received</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              onClick={handleSubmit}
              disabled={verifying}
            >
              {verifying ? 'Verifying...' : 'Verify & Enter'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
