import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Alert, AlertDescription } from '../../../ui/alert';
import {
  Play,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Monitor,
  Smartphone,
} from 'lucide-react';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
}

const mockValidationIssues: ValidationIssue[] = [
  { type: 'error', message: 'Question 5 has no correct answer selected' },
  { type: 'warning', message: 'Total points do not add up to 100' },
  { type: 'info', message: 'Consider adding more time for essay questions' },
];

export function PreviewTab() {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<ValidationIssue[] | null>(null);

  const runAutomatedTest = () => {
    setIsRunningTest(true);
    setTimeout(() => {
      setTestResults(mockValidationIssues);
      setIsRunningTest(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Preview Controls */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Eye className="size-5 text-teal-600" />
            Preview Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={previewMode === 'desktop' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('desktop')}
              className={
                previewMode === 'desktop'
                  ? 'bg-gradient-to-r from-teal-500 to-blue-600'
                  : ''
              }
            >
              <Monitor className="size-4 mr-2" />
              Desktop View
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'default' : 'outline'}
              onClick={() => setPreviewMode('mobile')}
              className={
                previewMode === 'mobile'
                  ? 'bg-gradient-to-r from-teal-500 to-blue-600'
                  : ''
              }
            >
              <Smartphone className="size-4 mr-2" />
              Mobile View
            </Button>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
            <div
              className={`bg-white rounded-lg shadow-lg mx-auto transition-all ${
                previewMode === 'desktop' ? 'w-full' : 'w-[375px]'
              }`}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg text-gray-800">Midterm Exam</h3>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    Published
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="size-4 text-teal-600" />
                    90 minutes
                  </div>
                  <span>•</span>
                  <span>45 questions</span>
                  <span>•</span>
                  <span>100 points</span>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Please read all instructions carefully before starting the exam. You will have
                    90 minutes to complete all questions.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm text-gray-600">Question 1</span>
                      <span className="text-sm text-teal-600">5 points</span>
                    </div>
                    <p className="text-gray-800 mb-3">
                      What is normalization in database design?
                    </p>
                    <div className="space-y-2">
                      {[
                        'Process of organizing data to reduce redundancy',
                        'Process of creating backups',
                        'Process of encrypting data',
                        'Process of indexing tables',
                      ].map((option, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input type="radio" name="q1" className="size-4 text-teal-600" />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-teal-500 to-blue-600">
                  Start Exam
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              This is a preview of how students will see the exam
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automated Testing */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Play className="size-5 text-teal-600" />
            Automated Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Run automated tests to check for common issues and errors in your exam configuration.
          </p>

          <Button
            onClick={runAutomatedTest}
            disabled={isRunningTest}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
          >
            {isRunningTest ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Run Automated Tests
              </>
            )}
          </Button>

          {testResults && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm text-gray-700">Test Results:</h4>

              {testResults.map((issue, idx) => {
                const config = {
                  error: {
                    icon: XCircle,
                    bgColor: 'bg-red-50',
                    borderColor: 'border-red-200',
                    textColor: 'text-red-800',
                    iconColor: 'text-red-600',
                  },
                  warning: {
                    icon: AlertTriangle,
                    bgColor: 'bg-amber-50',
                    borderColor: 'border-amber-200',
                    textColor: 'text-amber-800',
                    iconColor: 'text-amber-600',
                  },
                  info: {
                    icon: CheckCircle,
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200',
                    textColor: 'text-blue-800',
                    iconColor: 'text-blue-600',
                  },
                };

                const { icon: Icon, bgColor, borderColor, textColor, iconColor } =
                  config[issue.type];

                return (
                  <Alert key={idx} className={`${bgColor} ${borderColor}`}>
                    <Icon className={`size-4 ${iconColor}`} />
                    <AlertDescription className={textColor}>{issue.message}</AlertDescription>
                  </Alert>
                );
              })}

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mt-4">
                <div>
                  <p className="text-sm text-gray-700">
                    Found {testResults.filter((i) => i.type === 'error').length} errors,{' '}
                    {testResults.filter((i) => i.type === 'warning').length} warnings
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={runAutomatedTest}>
                  Re-run Tests
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accessibility Check */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-gray-800">Accessibility Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="size-4 text-green-600" />
              All images have alt text
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="size-4 text-green-600" />
              Sufficient color contrast
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="size-4 text-green-600" />
              Keyboard navigation supported
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="size-4 text-green-600" />
              Screen reader compatible
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
