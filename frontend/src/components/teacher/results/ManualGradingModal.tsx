import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { X, Save, User, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { EssayGradingItem } from '../../../types/teacher-results';
import { LoadingState } from '../common/LoadingState';

interface ManualGradingModalProps {
  examId: number;
  onClose: () => void;
}

export function ManualGradingModal({ examId, onClose }: ManualGradingModalProps) {
  const [answers, setAnswers] = useState<EssayGradingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState<number | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService
      .listEssays(examId)
      .then((data) => {
        if (cancelled) return;
        setAnswers(data);
        const firstPending = data.find((a) => a.status === 'pending') ?? data[0] ?? null;
        setSelectedAnswerId(firstPending ? firstPending.essayAnswerId : null);
        setScoreDraft(firstPending ? firstPending.currentScore : null);
        setFeedbackDraft('');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load essay answers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const selectedAnswer = answers.find((a) => a.essayAnswerId === selectedAnswerId) ?? null;
  const pendingCount = answers.filter((a) => a.status === 'pending').length;
  const gradedCount = answers.filter((a) => a.status === 'graded').length;

  const selectAnswer = (item: EssayGradingItem) => {
    setSelectedAnswerId(item.essayAnswerId);
    setScoreDraft(item.currentScore);
    setFeedbackDraft('');
  };

  const handleSaveGrade = async () => {
    if (!selectedAnswer) return;

    if (scoreDraft === null || scoreDraft < 0) {
      toast.error('Please enter a valid score');
      return;
    }
    if (scoreDraft > selectedAnswer.maxPoints) {
      toast.error(`Awarded Score cannot exceed the snapshot maximum of ${selectedAnswer.maxPoints}`);
      return;
    }

    setSaving(true);
    try {
      await teacherResultsService.gradeEssay(examId, selectedAnswer.essayAnswerId, scoreDraft);
      const updated = answers.map((a) =>
        a.essayAnswerId === selectedAnswer.essayAnswerId
          ? { ...a, currentScore: scoreDraft, status: 'graded' as const }
          : a,
      );
      setAnswers(updated);
      toast.success('Grade saved successfully');

      const nextPending = updated.find(
        (a) => a.status === 'pending' && a.essayAnswerId !== selectedAnswer.essayAnswerId,
      );
      if (nextPending) {
        selectAnswer(nextPending);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grade');
    } finally {
      setSaving(false);
    }
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
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <LoadingState variant="inline" label="Loading essay answers..." />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-600 p-12">{error}</div>
        ) : answers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 p-12">
            This exam has no essay answers to grade yet.
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex">
            {/* Student List - Left */}
            <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4 space-y-2">
                {answers.map((answer) => (
                  <Card
                    key={answer.essayAnswerId}
                    className={`cursor-pointer transition-all ${
                      selectedAnswerId === answer.essayAnswerId
                        ? 'border-teal-500 border-2 shadow-md'
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => selectAnswer(answer)}
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
                            <p className="text-xs text-gray-500">
                              {answer.studentId}
                              {answer.attemptNumber !== null && ` · Attempt ${answer.attemptNumber}`}
                            </p>
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
                              {selectedAnswer.studentId}
                              {selectedAnswer.attemptNumber !== null && ` · Attempt ${selectedAnswer.attemptNumber}`}
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
                          Snapshot Max Score: {selectedAnswer.maxPoints}
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
                          <Label>Awarded Score (out of {selectedAnswer.maxPoints})</Label>
                          <Input
                            type="number"
                            value={scoreDraft ?? ''}
                            onChange={(e) => setScoreDraft(e.target.value === '' ? null : parseFloat(e.target.value))}
                            placeholder="Enter score"
                            min="0"
                            max={selectedAnswer.maxPoints}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Feedback (optional, not saved yet)</Label>
                        <Textarea
                          value={feedbackDraft}
                          onChange={(e) => setFeedbackDraft(e.target.value)}
                          placeholder="Provide detailed feedback on the essay answer..."
                          rows={4}
                          className="resize-none"
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          onClick={handleSaveGrade}
                          disabled={saving}
                          className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600"
                        >
                          <Save className="size-4 mr-2" />
                          {saving ? 'Saving...' : 'Save Grade'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={onClose}
                          className="flex-1"
                        >
                          Close
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
