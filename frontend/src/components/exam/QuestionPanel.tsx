import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle2, Circle, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface Question {
  id: number;
  text: string;
  type: 'multiple-choice' | 'essay';
  options?: string[];
}

interface QuestionPanelProps {
  questions: Question[];
  currentQuestion: number;
  answers: Record<number, string>;
  onQuestionSelect: (index: number) => void;
  answeredCount: number;
  unansweredQuestions: number[];
}

export function QuestionPanel({
  questions,
  currentQuestion,
  answers,
  onQuestionSelect,
  answeredCount,
  unansweredQuestions,
}: QuestionPanelProps) {
  const isOnline = true; // Mock online status

  return (
    <div className="w-80 bg-white shadow-2xl border-l border-gray-200 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <h2 className="text-lg text-gray-800 mb-4">Question Navigator</h2>

        {/* Progress Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl text-green-700">{answeredCount}</p>
            <p className="text-xs text-green-600">Answered</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl text-gray-700">{questions.length - answeredCount}</p>
            <p className="text-xs text-gray-600">Remaining</p>
          </div>
        </div>

        {/* Network Status */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Question Grid */}
      <div className="p-4">
        <div className="grid grid-cols-5 gap-2 mb-4">
          {questions.map((question, index) => {
            const isAnswered = !!answers[question.id];
            const isCurrent = index === currentQuestion;

            return (
              <button
                key={question.id}
                onClick={() => onQuestionSelect(index)}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm transition-all ${
                  isCurrent
                    ? 'bg-teal-600 text-white ring-2 ring-teal-300'
                    : isAnswered
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="size-4 rounded bg-green-100"></div>
            <span className="text-gray-600">Answered</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="size-4 rounded bg-gray-100"></div>
            <span className="text-gray-600">Not Answered</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="size-4 rounded bg-teal-600"></div>
            <span className="text-gray-600">Current</span>
          </div>
        </div>

        {/* Unanswered Questions Alert */}
        {unansweredQuestions.length > 0 && (
          <Card className="border-0 bg-yellow-50 border-yellow-200 shadow-lg rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="size-5 text-yellow-700 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800">
                    {unansweredQuestions.length} question(s) not answered
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 border-yellow-300 hover:bg-yellow-100"
                onClick={() => onQuestionSelect(questions.findIndex((q) => q.id === unansweredQuestions[0]))}
              >
                Go to First Unanswered
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
