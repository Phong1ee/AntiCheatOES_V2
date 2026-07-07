import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Key, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';
import { mockExams } from '../../data/mockExams';

interface ExamCode {
  examTitle: string;
  code: string;
  validUntil: string;
}

export function ExamCodesWidget() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filter to only show exams that are OPEN NOW and have exam codes
  const activeExams = mockExams.filter(
    (exam) => exam.status === 'open' && exam.examCode
  );

  const examCodes: ExamCode[] = activeExams.map((exam) => ({
    examTitle: exam.title,
    code: exam.examCode!,
    validUntil: exam.codeValidUntil!,
  }));

  const handleCopy = (code: string) => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code)
        .then(() => {
          setCopiedCode(code);
          setTimeout(() => setCopiedCode(null), 2000);
        })
        .catch(() => {
          // Fallback to older method
          fallbackCopyTextToClipboard(code);
        });
    } else {
      // Use fallback method
      fallbackCopyTextToClipboard(code);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
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
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Show the code is selected at least
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    }
    
    document.body.removeChild(textArea);
  };

  return (
    <Card className="shadow-md border-teal-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="size-5 text-teal-600" />
          Exam Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {examCodes.map((exam, index) => (
          <div
            key={index}
            className="p-3 rounded-lg border border-gray-200 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm text-gray-900">{exam.examTitle}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Valid until: {exam.validUntil}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white rounded border border-teal-200 px-3 py-2">
                <code className="text-lg tracking-wider text-teal-700">
                  {exam.code}
                </code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(exam.code)}
                className="flex-shrink-0"
              >
                {copiedCode === exam.code ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ))}

        {examCodes.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Key className="size-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No exam codes available</p>
            <p className="text-xs mt-1">Codes will appear 15 minutes before exam</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}