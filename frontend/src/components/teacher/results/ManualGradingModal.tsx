import { useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { X, Save, User, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface EssayAnswer {
  studentId: string;
  studentName: string;
  studentCode: string;
  questionId: string;
  question: string;
  answer: string;
  maxPoints: number;
  currentScore: number | null;
  feedback: string;
  status: 'pending' | 'graded';
}

const mockEssayAnswers: EssayAnswer[] = [
  {
    studentId: '1',
    studentName: 'John Doe',
    studentCode: 'STU001',
    questionId: '3',
    question: 'Explain the differences between INNER JOIN and OUTER JOIN with examples.',
    answer: 'INNER JOIN returns only the rows that have matching values in both tables. For example, if we join Students and Enrollments tables, only students who have enrollments will be returned.\n\nOUTER JOIN (LEFT, RIGHT, or FULL) returns all rows from one or both tables, even if there are no matches. LEFT JOIN returns all students even if they have no enrollments, with NULL values for enrollment fields.\n\nExample:\nINNER JOIN: SELECT * FROM Students INNER JOIN Enrollments ON Students.id = Enrollments.student_id\nLEFT JOIN: SELECT * FROM Students LEFT JOIN Enrollments ON Students.id = Enrollments.student_id',
    maxPoints: 10,
    currentScore: null,
    feedback: '',
    status: 'pending',
  },
  {
    studentId: '2',
    studentName: 'Jane Smith',
    studentCode: 'STU002',
    questionId: '3',
    question: 'Explain the differences between INNER JOIN and OUTER JOIN with examples.',
    answer: 'INNER JOIN combines rows from two tables based on a related column. It only returns matching rows.\n\nOUTER JOIN includes non-matching rows. There are three types:\n- LEFT OUTER JOIN: All rows from left table\n- RIGHT OUTER JOIN: All rows from right table\n- FULL OUTER JOIN: All rows from both tables',
    maxPoints: 10,
    currentScore: 7.5,
    feedback: 'Good explanation of the concepts, but examples would make it more complete.',
    status: 'graded',
  },
  {
    studentId: '3',
    studentName: 'Mike Johnson',
    studentCode: 'STU003',
    questionId: '3',
    question: 'Explain the differences between INNER JOIN and OUTER JOIN with examples.',
    answer: 'They are different types of SQL joins. INNER JOIN shows matching data, OUTER JOIN shows all data.',
    maxPoints: 10,
    currentScore: null,
    feedback: '',
    status: 'pending',
  },
];

interface ManualGradingModalProps {
  examId: string;
  onClose: () => void;
}

export function ManualGradingModal({ examId, onClose }: ManualGradingModalProps) {
  const [answers, setAnswers] = useState<EssayAnswer[]>(mockEssayAnswers);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(
    answers.find((a) => a.status === 'pending')?.studentId || answers[0]?.studentId || null
  );

  const selectedAnswer = answers.find((a) => a.studentId === selectedAnswerId);
  const pendingCount = answers.filter((a) => a.status === 'pending').length;
  const gradedCount = answers.filter((a) => a.status === 'graded').length;

  const handleScoreChange = (studentId: string, score: number) => {
    setAnswers(
      answers.map((a) =>
        a.studentId === studentId ? { ...a, currentScore: score } : a
      )
    );
  };

  const handleFeedbackChange = (studentId: string, feedback: string) => {
    setAnswers(
      answers.map((a) =>
        a.studentId === studentId ? { ...a, feedback } : a
      )
    );
  };

  const handleSaveGrade = () => {
    if (!selectedAnswer) return;

    if (selectedAnswer.currentScore === null || selectedAnswer.currentScore < 0) {
      toast.error('Please enter a valid score');
      return;
    }

    if (selectedAnswer.currentScore > selectedAnswer.maxPoints) {
      toast.error(`Score cannot exceed ${selectedAnswer.maxPoints} points`);
      return;
    }

    setAnswers(
      answers.map((a) =>
        a.studentId === selectedAnswerId
          ? { ...a, status: 'graded' }
          : a
      )
    );

    toast.success('Grade saved successfully');

    // Move to next pending answer
    const nextPending = answers.find(
      (a) => a.status === 'pending' && a.studentId !== selectedAnswerId
    );
    if (nextPending) {
      setSelectedAnswerId(nextPending.studentId);
    }
  };

  const handleSaveAllAndClose = () => {
    toast.success('All grades saved successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-500 to-blue-600">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl text-white">Grade Essay Questions</h2>
              <p className="text-sm text-white/90 mt-1">
                Review and grade essay questions from the exam
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-white text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-lg">
                Pending: {pendingCount}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-lg">
                Graded: {gradedCount}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Student List - Left */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4 space-y-2">
              {answers.map((answer) => (
                <Card
                  key={answer.studentId}
                  className={`cursor-pointer transition-all ${
                    selectedAnswerId === answer.studentId
                      ? 'border-teal-500 border-2 shadow-md'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedAnswerId(answer.studentId)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-teal-100 rounded-lg">
                          <User className="size-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-800">
                            {answer.studentName}
                          </p>
                          <p className="text-xs text-gray-500">{answer.studentCode}</p>
                        </div>
                      </div>
                      {answer.status === 'graded' ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="size-3 mr-1" />
                          Graded
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Essay Score:</span>
                      <span className="font-medium">
                        {answer.currentScore !== null
                          ? `${answer.currentScore}/${answer.maxPoints}`
                          : `—/${answer.maxPoints}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Grading Panel - Right */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedAnswer ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="size-16 text-gray-300 mx-auto mb-4" />
                  <p>No answer selected</p>
                  <p className="text-sm mt-2">Select a student to grade their essay question</p>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Student Info */}
                <Card className="shadow-md rounded-2xl border-0 bg-gradient-to-r from-teal-50 to-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white rounded-xl">
                          <User className="size-6 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="text-lg text-gray-800">
                            {selectedAnswer.studentName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {selectedAnswer.studentCode}
                          </p>
                        </div>
                      </div>
                      {selectedAnswer.status === 'graded' && (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="size-4 mr-1" />
                          Already Graded
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Question */}
                <Card className="shadow-md rounded-2xl border-0">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <Label className="text-base">Essay Question</Label>
                      <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                        {selectedAnswer.question}
                      </p>
                      <p className="text-sm text-teal-600 mt-2">
                        Max Points: {selectedAnswer.maxPoints}
                      </p>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <Label className="text-base">Student's Essay Answer</Label>
                      <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {selectedAnswer.answer}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Grading Section */}
                <Card className="shadow-md rounded-2xl border-0 border-t-4 border-t-teal-500">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-lg text-gray-800">Grade Assignment</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Score (out of {selectedAnswer.maxPoints})</Label>
                        <Input
                          type="number"
                          value={selectedAnswer.currentScore ?? ''}
                          onChange={(e) =>
                            handleScoreChange(
                              selectedAnswer.studentId,
                              parseFloat(e.target.value)
                            )
                          }
                          placeholder="Enter score"
                          min="0"
                          max={selectedAnswer.maxPoints}
                          step="0.5"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Feedback (optional)</Label>
                      <Textarea
                        value={selectedAnswer.feedback}
                        onChange={(e) =>
                          handleFeedbackChange(selectedAnswer.studentId, e.target.value)
                        }
                        placeholder="Provide detailed feedback on the essay answer..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleSaveGrade}
                        className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600"
                      >
                        <Save className="size-4 mr-2" />
                        Save Grade
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSaveAllAndClose}
                        className="flex-1"
                      >
                        Save All & Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
