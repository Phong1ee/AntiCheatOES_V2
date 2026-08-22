import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import type { StudentAnswer, StudentQuestion } from '../../types/student-exam';
import { QuestionImage } from '../common/QuestionImage';
import { studentExamService } from '../../services/student-exam.service';

interface QuestionAreaProps {
  question: StudentQuestion;
  currentQuestion: number;
  totalQuestions: number;
  answer?: StudentAnswer;
  onAnswerChange: (questionId: number, answer: StudentAnswer) => void;
  onPrevious: () => void;
  onNext: () => void;
  sequentialNavigation: boolean;
  currentAnswerIsValid: boolean;
  isSavingNext: boolean;
  isMarked: boolean;
  onToggleMark: () => void;
}

export function QuestionArea({
  question,
  currentQuestion,
  totalQuestions,
  answer,
  onAnswerChange,
  onPrevious,
  onNext,
  sequentialNavigation,
  currentAnswerIsValid,
  isSavingNext,
  isMarked,
  onToggleMark,
}: QuestionAreaProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-xl rounded-2xl border-0">
        <CardHeader className="flex-row items-center justify-between border-b bg-gradient-to-r from-teal-50 to-blue-50">
          <CardTitle className="text-lg text-gray-700">
            Question {currentQuestion + 1} of {totalQuestions}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleMark}
            className={isMarked ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200' : 'border-gray-300 text-gray-700 hover:border-amber-300 hover:bg-amber-50'}
          >
            <Flag className={`mr-2 size-4 ${isMarked ? 'fill-amber-500 text-amber-600' : ''}`} />
            {isMarked ? 'Marked for review' : 'Mark for review'}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6">
            <p className="text-lg text-gray-800 leading-relaxed">{question.text}</p>
            {question.hasImage && (
              <QuestionImage
                questionId={question.id}
                load={studentExamService.fetchQuestionImage}
                className="mt-4"
              />
            )}
          </div>

      {(question.type === 'multiple-choice' || question.type === 'true-false') && question.options && (
            <div className="space-y-3">
              {question.options.map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                const isSelected = 'selectedOptionId' in (answer ?? {}) && answer.selectedOptionId === option.id;

                return (
                  <label
                    key={option.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={isSelected}
                      onChange={() => onAnswerChange(question.id, { selectedOptionId: option.id })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-gray-200 text-sm mr-3">
                        {optionLabel}
                      </span>
                      <span className="text-gray-800">{option.text}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {question.type === 'essay' && (
            <div>
              <Textarea
                value={answer && 'answerText' in answer ? answer.answerText : ''}
                onChange={(e) => onAnswerChange(question.id, { answerText: e.target.value })}
                placeholder="Type your answer here..."
                className="min-h-[200px] text-base"
              />
              <p className="text-sm text-gray-500 mt-2">
                {answer && 'answerText' in answer ? answer.answerText.length : 0} characters
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={sequentialNavigation || currentQuestion === 0}
          className="px-6"
        >
          <ChevronLeft className="size-4 mr-2" />
          Previous
        </Button>

        <div className="text-sm text-gray-600">
          Page {currentQuestion + 1} / {totalQuestions}
        </div>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={currentQuestion === totalQuestions - 1 || (sequentialNavigation && (!currentAnswerIsValid || isSavingNext))}
          className="px-6"
        >
          {sequentialNavigation ? (isSavingNext ? 'Saving...' : 'Continue') : 'Next'}
          <ChevronRight className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
