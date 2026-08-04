import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Key, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';
import type { StudentExamListItem } from '../../services/student-exam.service';

interface ExamCodesWidgetProps {
  exams: StudentExamListItem[];
}

export function ExamCodesWidget({ exams }: ExamCodesWidgetProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (examId: string, code: string) => {
    const copyKey = `${examId}:${code}`;
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code)
        .then(() => {
          setCopiedCode(copyKey);
          setTimeout(() => setCopiedCode(null), 2000);
        })
        .catch(() => {
          // Fallback to older method
          fallbackCopyTextToClipboard(code, copyKey);
        });
    } else {
      // Use fallback method
      fallbackCopyTextToClipboard(code, copyKey);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, copyKey: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      setCopiedCode(copyKey);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Show the code is selected at least
      setCopiedCode(copyKey);
      setTimeout(() => setCopiedCode(null), 2000);
    }
    
    document.body.removeChild(textArea);
  };

  return (
    <Card className="w-full min-w-0 box-border overflow-hidden shadow-md border-teal-100">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="size-5 text-teal-600" />
          Exam Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="w-full min-w-0 box-border max-h-[360px] space-y-3 overflow-x-hidden overflow-y-auto px-4 sm:px-6">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="w-full min-w-0 box-border space-y-2 rounded-lg border border-gray-200 bg-gradient-to-r from-teal-50 to-blue-50 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">{exam.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Valid until: {exam.endTime ? new Date(exam.endTime).toLocaleString() : 'Not specified'}
                </p>
              </div>
            </div>
            
            {exam.examCode ? (
              <div className="flex w-full min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 overflow-hidden rounded border border-teal-200 bg-white px-3 py-2">
                  <code className="block truncate text-lg tracking-wider text-teal-700">{exam.examCode}</code>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleCopy(exam.id, exam.examCode!)} className="shrink-0">
                  {copiedCode === `${exam.id}:${exam.examCode}` ? <CheckCircle2 className="size-4 text-green-600" /> : <Copy className="size-4" />}
                </Button>
              </div>
            ) : <p className="text-sm text-gray-600">No code available</p>}
          </div>
        ))}

        {exams.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Key className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No exam codes available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
