import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  X,
  Calendar,
  Clock,
  Users,
  FileText,
  Award,
  AlertCircle,
  CheckCircle,
  Target,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  totalStudents: number;
  completedStudents: number;
  averageScore: number | null;
  status: 'upcoming' | 'ongoing' | 'completed';
}

interface ExamDetailsModalProps {
  exam: Exam;
  onClose: () => void;
}

const statusConfig = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ongoing: { label: 'Ongoing', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
};

// Mock exam details data
const getExamDetails = (examId: string) => ({
  description: 'Comprehensive assessment covering all topics from weeks 1-7 of the course.',
  passingScore: 60,
  totalQuestions: 40,
  questionBreakdown: [
    { type: 'Multiple Choice', count: 25, points: 50 },
    { type: 'True/False', count: 10, points: 20 },
    { type: 'Essay', count: 5, points: 30 },
  ],
  topics: [
    'Database Design & Normalization',
    'SQL Queries & Joins',
    'Transactions & ACID Properties',
    'Indexing & Performance',
  ],
  instructions: [
    'Read all questions carefully before answering',
    'You can navigate between questions freely',
    'Click "Submit" when you have completed all questions',
    'Ensure stable internet connection throughout the exam',
  ],
  proctoring: {
    webcam: true,
    screenRecording: true,
    tabSwitchDetection: true,
    copyPasteBlocking: true,
  },
});

export function ExamDetailsModal({ exam, onClose }: ExamDetailsModalProps) {
  const config = statusConfig[exam.status];
  const details = getExamDetails(exam.id);
  const completionRate = exam.totalStudents > 0 
    ? (exam.completedStudents / exam.totalStudents * 100).toFixed(0) 
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header with Gradient */}
        <div className="relative bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white rounded-t-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </Button>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <FileText className="size-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-2xl">{exam.title}</h2>
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  {config.label}
                </Badge>
              </div>
              <p className="text-white/90">{exam.subject}</p>
              <p className="text-white/80 text-sm mt-2">{details.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Calendar className="size-4" />
                <span className="text-xs">Date & Time</span>
              </div>
              <p className="text-sm text-gray-800">
                {new Date(exam.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-gray-700">{exam.time}</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 text-purple-700 mb-1">
                <Clock className="size-4" />
                <span className="text-xs">Duration</span>
              </div>
              <p className="text-lg text-gray-800">{exam.duration} min</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
              <div className="flex items-center gap-2 text-teal-700 mb-1">
                <Users className="size-4" />
                <span className="text-xs">Students</span>
              </div>
              <p className="text-lg text-gray-800">{exam.totalStudents}</p>
              <p className="text-xs text-gray-600">{completionRate}% completed</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <Target className="size-4" />
                <span className="text-xs">Passing Score</span>
              </div>
              <p className="text-lg text-gray-800">{details.passingScore}%</p>
            </div>
          </div>

          {/* Question Breakdown */}
          <div className="space-y-3">
            <h3 className="text-lg text-gray-800 flex items-center gap-2">
              <BookOpen className="size-5 text-teal-600" />
              Question Breakdown
            </h3>
            <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-200">
              <div className="space-y-3">
                {details.questionBreakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-sm">
                        {item.count}
                      </div>
                      <span className="text-gray-800">{item.type}</span>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {item.points} points
                    </Badge>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Total</span>
                    <div className="flex gap-4">
                      <span className="text-gray-800">
                        <span className="font-medium">{details.totalQuestions}</span> questions
                      </span>
                      <span className="text-gray-800">
                        <span className="font-medium">
                          {details.questionBreakdown.reduce((sum, item) => sum + item.points, 0)}
                        </span>{' '}
                        points
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Topics Covered */}
          <div className="space-y-3">
            <h3 className="text-lg text-gray-800 flex items-center gap-2">
              <Award className="size-5 text-teal-600" />
              Topics Covered
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {details.topics.map((topic, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-200"
                >
                  <CheckCircle className="size-4 text-teal-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{topic}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-lg text-gray-800 flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-600" />
              Exam Instructions
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <ul className="space-y-2">
                {details.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Proctoring Settings */}
          <div className="space-y-3">
            <h3 className="text-lg text-gray-800 flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              Security & Proctoring
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(details.proctoring).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border ${
                    enabled
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {enabled ? (
                      <CheckCircle className="size-4 text-green-600" />
                    ) : (
                      <X className="size-4 text-gray-400" />
                    )}
                    <span
                      className={`text-sm ${
                        enabled ? 'text-gray-800' : 'text-gray-500'
                      }`}
                    >
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Stats (if completed) */}
          {exam.averageScore !== null && (
            <div className="space-y-3">
              <h3 className="text-lg text-gray-800 flex items-center gap-2">
                <Award className="size-5 text-purple-600" />
                Performance Statistics
              </h3>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl text-gray-800">{exam.averageScore.toFixed(1)}%</p>
                    <p className="text-xs text-gray-600 mt-1">Average Score</p>
                  </div>
                  <div>
                    <p className="text-2xl text-gray-800">{exam.completedStudents}</p>
                    <p className="text-xs text-gray-600 mt-1">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl text-gray-800">
                      {exam.totalStudents - exam.completedStudents}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Pending</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="px-6">
            <ArrowLeft className="size-4 mr-2" />
            Close
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="hover:bg-teal-50 hover:border-teal-300 border-teal-200"
            >
              Edit Exam
            </Button>
            <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg">
              View Full Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
