import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  BookOpen,
  Users,
  TrendingUp,
  Clock,
  Bell,
  Database,
  FileQuestion,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface UpcomingExam {
  id: string;
  name: string;
  subject: string;
  date: string;
  time: string;
  daysUntil: number;
}

interface QuestionBank {
  id: string;
  name: string;
  subject: string;
  questionCount: number;
}

const mockQuestionBanks: QuestionBank[] = [
  { id: '1', name: 'Database Fundamentals', subject: 'Database Systems', questionCount: 150 },
  { id: '2', name: 'HTML & CSS', subject: 'Web Development', questionCount: 200 },
  { id: '3', name: 'JavaScript ES6+', subject: 'Web Development', questionCount: 180 },
  { id: '4', name: 'Arrays & Linked Lists', subject: 'Data Structures', questionCount: 120 },
];

const mockNotifications = [
  { id: '1', message: '35 students completed Quiz 3', time: '10 min ago', type: 'info' },
  { id: '2', message: 'Midterm Exam starting in 6 days', time: '1 hour ago', type: 'warning' },
  { id: '3', message: 'New question added to Database bank', time: '2 hours ago', type: 'success' },
];

const mockUpcomingExams: UpcomingExam[] = [
  {
    id: '1',
    name: 'Midterm - Database Systems',
    subject: 'Database Systems',
    date: 'Nov 20, 2025',
    time: '9:00 AM',
    daysUntil: 6,
  },
  {
    id: '2',
    name: 'Quiz 4 - Data Structures',
    subject: 'Data Structures',
    date: 'Nov 22, 2025',
    time: '2:00 PM',
    daysUntil: 8,
  },
  {
    id: '3',
    name: 'Final - Web Development',
    subject: 'Web Development',
    date: 'Nov 25, 2025',
    time: '10:00 AM',
    daysUntil: 11,
  },
  {
    id: '4',
    name: 'Midterm - Algorithms',
    subject: 'Algorithms',
    date: 'Nov 27, 2025',
    time: '1:00 PM',
    daysUntil: 13,
  },
];

interface TeacherInfoSidebarProps {
  onExamClick?: (examId: string) => void;
}

export function TeacherInfoSidebar({ onExamClick }: TeacherInfoSidebarProps) {
  const [timeToNextExam, setTimeToNextExam] = useState({
    days: 6,
    hours: 14,
    minutes: 23,
  });
  const [activeExamsCount, setActiveExamsCount] = useState(0);

  useEffect(() => {
    const fetchActiveExams = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error("Authentication token not found");
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_BASE_URL}/api/teacher/exams`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch exams");
        }

        const data = await response.json();
        setActiveExamsCount(data.active_exams_count || 0);
      } catch (err) {
        console.error('Failed to fetch active exams:', err);
        setActiveExamsCount(0);
      }
    };

    fetchActiveExams();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeToNextExam((prev) => {
        if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1 };
        }
        if (prev.hours > 0) {
          return { days: prev.days, hours: prev.hours - 1, minutes: 59 };
        }
        if (prev.days > 0) {
          return { days: prev.days - 1, hours: 23, minutes: 59 };
        }
        return prev;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <TrendingUp className="size-5 text-teal-600" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <BookOpen className="size-5 text-teal-700" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Exams</p>
                <p className="text-xl text-gray-800">{activeExamsCount}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="size-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-xl text-gray-800">135</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="size-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Performance</p>
                <p className="text-xl text-gray-800">82.5%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Exam Countdown */}
      <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Clock className="size-5 text-teal-600" />
            Upcoming Exams
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockUpcomingExams.map((exam) => (
            <div
              key={exam.id}
              onClick={() => onExamClick?.(exam.id)}
              className="p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 group-hover:text-teal-700 transition-colors">
                    {exam.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{exam.subject}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                    <Calendar className="size-3 text-teal-600" />
                    <span>{exam.date} at {exam.time}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 text-xs">
                    {exam.daysUntil}d
                  </Badge>
                  <ChevronRight className="size-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Question Banks */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Database className="size-5 text-teal-600" />
            Question Banks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockQuestionBanks.map((bank) => (
            <div
              key={bank.id}
              className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  <FileQuestion className="size-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{bank.name}</p>
                    <p className="text-xs text-gray-500">{bank.subject}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-xs">
                  {bank.questionCount}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Bell className="size-5 text-teal-600" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-xl border ${
                notification.type === 'warning'
                  ? 'bg-amber-50 border-amber-200'
                  : notification.type === 'success'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <p className="text-sm text-gray-800">{notification.message}</p>
              <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}