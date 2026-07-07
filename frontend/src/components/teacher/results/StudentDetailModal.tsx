import { useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Progress } from '../../ui/progress';
import {
  X,
  User,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  Mail,
  Star,
  TrendingUp,
  Award,
  ArrowLeft,
} from 'lucide-react';

interface QuestionAttempt {
  questionNumber: number;
  question: string;
  type: 'mcq' | 'true-false' | 'essay';
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean | null;
  points: number;
  maxPoints: number;
}

interface StudentDetailModalProps {
  studentId: string;
  onClose: () => void;
}

const mockAttempt = {
  studentId: 'ST001',
  studentName: 'Alice Johnson',
  score: 95,
  correctAnswers: 19,
  totalQuestions: 20,
  timeSpent: '18m 23s',
  startTime: '2025-11-14T10:00:00',
  submitTime: '2025-11-14T10:18:23',
  questions: [
    {
      questionNumber: 1,
      question: 'What is normalization in database design?',
      type: 'mcq' as const,
      correctAnswer: 'A process to organize data to reduce redundancy',
      studentAnswer: 'A process to organize data to reduce redundancy',
      isCorrect: true,
      points: 5,
      maxPoints: 5,
    },
    {
      questionNumber: 2,
      question: 'A primary key can contain NULL values.',
      type: 'true-false' as const,
      correctAnswer: 'False',
      studentAnswer: 'False',
      isCorrect: true,
      points: 5,
      maxPoints: 5,
    },
    {
      questionNumber: 3,
      question: 'Which SQL command is used to retrieve data?',
      type: 'mcq' as const,
      correctAnswer: 'SELECT',
      studentAnswer: 'INSERT',
      isCorrect: false,
      points: 0,
      maxPoints: 5,
    },
    {
      questionNumber: 4,
      question: 'Explain ACID properties of database transactions.',
      type: 'essay' as const,
      correctAnswer:
        'ACID stands for Atomicity, Consistency, Isolation, Durability...',
      studentAnswer:
        'ACID properties ensure reliable transactions. Atomicity means all or nothing, Consistency maintains database rules, Isolation prevents interference, and Durability ensures changes persist.',
      isCorrect: true,
      points: 10,
      maxPoints: 10,
    },
    {
      questionNumber: 5,
      question: 'What is a foreign key?',
      type: 'mcq' as const,
      correctAnswer: 'A field that links to a primary key in another table',
      studentAnswer: null as any,
      isCorrect: null,
      points: 0,
      maxPoints: 5,
    },
  ] as QuestionAttempt[],
};

export function StudentDetailModal({ studentId, onClose }: StudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState('answers');

  const correctCount = mockAttempt.questions.filter((q) => q.isCorrect === true).length;
  const incorrectCount = mockAttempt.questions.filter((q) => q.isCorrect === false).length;
  const skippedCount = mockAttempt.questions.filter((q) => q.isCorrect === null).length;
  const correctPercentage = (correctCount / mockAttempt.totalQuestions) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 flex flex-col">
        {/* Header with Gradient Background */}
        <div className="relative bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white rounded-t-2xl flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </Button>

          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="size-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
              <User className="size-10 text-white" />
            </div>

            {/* Student Info */}
            <div className="flex-1">
              <h2 className="text-2xl mb-1">{mockAttempt.studentName}</h2>
              <p className="text-teal-100 mb-4">Student ID: {mockAttempt.studentId}</p>
              
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <Calendar className="size-4" />
                  <span>
                    Started: {new Date(mockAttempt.startTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <CheckCircle className="size-4" />
                  <span>
                    Submitted: {new Date(mockAttempt.submitTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Score Badge */}
            <div className="text-center bg-white/20 backdrop-blur-sm px-6 py-4 rounded-2xl border-2 border-white/30">
              <Trophy className="size-8 mx-auto mb-2 text-amber-300" />
              <p className="text-4xl mb-1">{mockAttempt.score}</p>
              <p className="text-sm text-teal-100">Score</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="size-6 text-green-600" />
              </div>
              <p className="text-2xl text-green-700 mb-1">{correctCount}</p>
              <p className="text-xs text-gray-600">Correct</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-red-50 to-pink-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="size-6 text-red-600" />
              </div>
              <p className="text-2xl text-red-700 mb-1">{incorrectCount}</p>
              <p className="text-xs text-gray-600">Incorrect</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="size-6 text-amber-600" />
              </div>
              <p className="text-2xl text-amber-700 mb-1">{skippedCount}</p>
              <p className="text-xs text-gray-600">Skipped</p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-4 text-center">
              <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="size-6 text-blue-600" />
              </div>
              <p className="text-xl text-blue-700 mb-1">{mockAttempt.timeSpent}</p>
              <p className="text-xs text-gray-600">Time Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-200">
            <TabsList className="bg-gray-100 p-1 rounded-lg">
              <TabsTrigger
                value="answers"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
              >
                Answer Details
              </TabsTrigger>
              <TabsTrigger
                value="statistics"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
              >
                Performance Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Answer Details Tab */}
          <TabsContent 
            value="answers" 
            className="flex-1 overflow-y-auto p-6 space-y-4 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
            style={{ maxHeight: 'calc(90vh - 480px)' }}
          >
            {mockAttempt.questions.map((q) => (
              <Card
                key={q.questionNumber}
                className={`shadow-lg rounded-2xl overflow-hidden border-l-4 ${
                  q.isCorrect === true
                    ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-white'
                    : q.isCorrect === false
                    ? 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-white'
                    : 'border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-white'
                }`}
              >
                <CardContent className="p-5">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {q.isCorrect === true && (
                          <div className="size-10 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="size-6 text-green-600" />
                          </div>
                        )}
                        {q.isCorrect === false && (
                          <div className="size-10 bg-red-100 rounded-full flex items-center justify-center">
                            <XCircle className="size-6 text-red-600" />
                          </div>
                        )}
                        {q.isCorrect === null && (
                          <div className="size-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="size-6 text-amber-600" />
                          </div>
                        )}
                      </div>

                      {/* Question Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-gray-800 text-white">
                            Question {q.questionNumber}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              q.type === 'mcq'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : q.type === 'true-false'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }
                          >
                            {q.type === 'mcq'
                              ? 'Multiple Choice'
                              : q.type === 'true-false'
                              ? 'True/False'
                              : 'Essay'}
                          </Badge>
                        </div>
                        <p className="text-gray-800 text-lg">{q.question}</p>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                      <p className="text-2xl text-gray-800">
                        {q.points}
                        <span className="text-lg text-gray-400">/{q.maxPoints}</span>
                      </p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>

                  {/* Answers Comparison */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Student Answer */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="size-4 text-gray-600" />
                        <p className="text-sm text-gray-600">Student's Answer</p>
                      </div>
                      <div
                        className={`p-4 rounded-xl border-2 ${
                          q.isCorrect === true
                            ? 'bg-green-50 border-green-200'
                            : q.isCorrect === false
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <p className="text-gray-800">
                          {q.studentAnswer || (
                            <span className="text-gray-400 italic">Not answered</span>
                          )}
                        </p>
                        {q.isCorrect === true && (
                          <div className="flex items-center gap-1 mt-2 text-green-700">
                            <CheckCircle className="size-4" />
                            <span className="text-xs">Correct!</span>
                          </div>
                        )}
                        {q.isCorrect === false && (
                          <div className="flex items-center gap-1 mt-2 text-red-700">
                            <XCircle className="size-4" />
                            <span className="text-xs">Incorrect</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Correct Answer */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="size-4 text-green-600" />
                        <p className="text-sm text-gray-600">Correct Answer</p>
                      </div>
                      <div className="p-4 rounded-xl border-2 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <p className="text-gray-800">{q.correctAnswer}</p>
                        <div className="flex items-center gap-1 mt-2 text-green-700">
                          <Star className="size-4 fill-green-600" />
                          <span className="text-xs">Reference answer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent 
            value="statistics" 
            className="flex-1 overflow-y-auto p-6 mt-0 scrollbar-thin scrollbar-thumb-teal-500 scrollbar-track-gray-100"
            style={{ maxHeight: 'calc(90vh - 480px)' }}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Performance Overview */}
              <Card className="shadow-lg rounded-2xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg text-gray-800">Performance Overview</h3>
                      <p className="text-sm text-gray-600">Detailed breakdown of results</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Overall Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Overall Score</span>
                        <span className="text-2xl text-gray-800">{mockAttempt.score}%</span>
                      </div>
                      <Progress value={mockAttempt.score} className="h-3" />
                      <p className="text-xs text-gray-500 mt-1">
                        {mockAttempt.score >= 90
                          ? '🎉 Excellent performance!'
                          : mockAttempt.score >= 75
                          ? '👍 Good job!'
                          : mockAttempt.score >= 60
                          ? '✓ Satisfactory'
                          : '⚠ Needs improvement'}
                      </p>
                    </div>

                    {/* Correct Answers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Correct Answers</span>
                        <span className="text-lg text-green-700">
                          {correctCount} / {mockAttempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                          style={{ width: `${correctPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Incorrect Answers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Incorrect Answers</span>
                        <span className="text-lg text-red-700">
                          {incorrectCount} / {mockAttempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
                          style={{
                            width: `${(incorrectCount / mockAttempt.totalQuestions) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Skipped */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700">Skipped Questions</span>
                        <span className="text-lg text-amber-700">
                          {skippedCount} / {mockAttempt.totalQuestions}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                          style={{
                            width: `${(skippedCount / mockAttempt.totalQuestions) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="size-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-gray-600">Time Efficiency</p>
                        <p className="text-2xl text-gray-800">{mockAttempt.timeSpent}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">Out of 30 minutes allocated</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Award className="size-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-gray-600">Accuracy Rate</p>
                        <p className="text-2xl text-gray-800">{correctPercentage.toFixed(0)}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {correctCount} out of {mockAttempt.totalQuestions - skippedCount} attempted
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Summary */}
              <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
                <CardContent className="p-6">
                  <h4 className="text-gray-800 mb-4 flex items-center gap-2">
                    <Star className="size-5 text-amber-500 fill-amber-500" />
                    Performance Summary
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Total Score</span>
                      <span className="text-gray-800">{mockAttempt.score} / 100</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Questions Attempted</span>
                      <span className="text-gray-800">
                        {mockAttempt.totalQuestions - skippedCount} / {mockAttempt.totalQuestions}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Success Rate</span>
                      <span className="text-gray-800">{correctPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Completion Status</span>
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        Completed
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="px-6 hover:bg-gray-100 border-gray-300"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Results
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="hover:bg-green-50 hover:border-green-300 border-green-200"
            >
              <Download className="size-4 mr-2 text-green-600" />
              Export Result
            </Button>
            <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg">
              <Mail className="size-4 mr-2" />
              Send to Student
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}