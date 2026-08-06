import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { LoadingState } from './common/LoadingState';
import {
  BookOpen,
  Users,
  TrendingUp,
  Clock,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface UpcomingExam {
  exam_id: string;
  title: string;
  subject: string;
  start_time: string;
  end_time: string;
}

interface QuickStat {
  activeExams: number;
  totalStudents: number;
  averagePerformance: number; 
}

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
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error("Authentication token not found");
        }

        const API_BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_BASE_URL}/api/teacher/get_exam_overview`, {
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
        console.log("Fetched exam data:", data);
        setActiveExamsCount(Array.isArray(data.active_exams) ? data.active_exams.length : 0);
        setTotalStudentsCount(data.total_students || 0);
        setUpcomingExams(data.upcoming_exams || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setActiveExamsCount(0);
        setTotalStudentsCount(0);
        setUpcomingExams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExamData();
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
                <p className="text-xl text-gray-800">{totalStudentsCount}</p>
              </div>
            </div>
          </div>

          {/* <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="size-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Performance</p>
                <p className="text-xl text-gray-800">82.5%</p>
              </div>
            </div>
          </div> */}
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
          {loading ? (
            <LoadingState variant="inline" label="Loading exams..." />
          ) : upcomingExams.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming exams</p>
          ) : (
            upcomingExams.map((exam) => {
              const startTime = new Date(exam.start_time);
              const now = new Date();
              const diffTime = startTime.getTime() - now.getTime();
              const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const formattedDate = startTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
              const formattedTime = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={exam.exam_id}
                  onClick={() => onExamClick?.(String(exam.exam_id))}
                  className="p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 group-hover:text-teal-700 transition-colors">
                        {exam.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{exam.subject}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                        <Calendar className="size-3 text-teal-600" />
                        <span>{formattedDate} at {formattedTime}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 text-xs">
                        {daysUntil}d
                      </Badge>
                      <ChevronRight className="size-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}