import { CheckCircle, Home } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface ExamSubmittedProps {
  onExit: () => void;
}

export function ExamSubmitted({ onExit }: ExamSubmittedProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl rounded-2xl border-0">
        <CardContent className="pt-12 pb-8 px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-6 bg-gradient-to-br from-green-400 to-teal-500 rounded-full shadow-lg">
              <CheckCircle className="size-16 text-white" />
            </div>
          </div>

          <h1 className="text-3xl text-gray-800 mb-4">Exam Submitted Successfully!</h1>
          
          <p className="text-lg text-gray-600 mb-6">
            Your exam has been submitted and recorded. Thank you for your participation.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-lg text-gray-800 mb-4">Submission Details</h2>
            <div className="space-y-3 text-left">
              <div className="flex justify-between">
                <span className="text-gray-600">Exam:</span>
                <span className="text-gray-800">Midterm - Database Systems</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Submission Time:</span>
                <span className="text-gray-800">
                  {new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="text-green-700">✓ Submitted</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Your exam is being processed. Results will be available 
              within 24-48 hours and you will be notified via email.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={onExit}
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg"
            >
              <Home className="size-4 mr-2" />
              Return to My Exams
            </Button>
            
            <p className="text-sm text-gray-500">
              You can view your results in the "My Exams" section once grading is complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
