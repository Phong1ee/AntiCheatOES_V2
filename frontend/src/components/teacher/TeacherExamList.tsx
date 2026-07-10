import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Calendar,
  Clock,
  Settings,
  BarChart3,
  Eye,
  Search,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { Input } from '../ui/input';
import { ExamDetailsModal } from './ExamDetailsModal';
import { ExamSettingsModal } from './ExamSettingsModal';
import { ExamResultsModal } from './ExamResultsModal';

interface Exam {
  exam_id: number;
  title: string;
  examcode: string;
  description: string;
  max_attempt: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  totalStudents: number;
  manage_by: string;
  status: string;
  subject?: string | null;
}

// Status configuration
const navigate = useNavigate();
const statusConfig = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ongoing: { label: 'Ongoing', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
};

interface TeacherExamListProps {
  onExamClick?: (examId: string) => void;
}

export function TeacherExamList({ onExamClick }: TeacherExamListProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
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
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to fetch exams");
        }

        const data = await response.json();
        console.log('Teacher exams response:', data);
        setExams(Array.isArray(data) ? data : (data.exams || []));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch exams');
        setExams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Loading exams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg rounded-2xl border-0">
        <CardContent className="p-12 text-center">
          <AlertCircle className="size-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-red-600 mb-2">Error Loading Exams</h3>
          {/* <p className="text-sm text-gray-600">{error}</p> */}
        </CardContent>
      </Card>
    );
  }

  const filteredExams = exams
    // Filter by status
    .filter((exam) => filterStatus === 'all' || exam.status === filterStatus)
    // Filter by search query
    .filter((exam) => {
      const query = searchQuery.toLowerCase();
      return (
        exam.title.toLowerCase().includes(query) ||
        exam.description.toLowerCase().includes(query) ||
        exam.examcode.toLowerCase().includes(query)
      );
    })
    // Sort
    .sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      } else if (sortBy === 'date-asc') {
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      } else if (sortBy === 'subject-asc') {
        return a.description.localeCompare(b.description);
      } else if (sortBy === 'subject-desc') {
        return b.description.localeCompare(a.description);
      }
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search exams by title or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="size-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="subject-asc">Subject (A-Z)</SelectItem>
                  <SelectItem value="subject-desc">Subject (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div className="grid gap-4">
        {filteredExams.map((exam) => {
          return (
            <Card key={exam.exam_id} className="shadow-lg rounded-2xl border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  {/* Exam Info */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-nowrap">
                          <h3 className="text-lg text-gray-800 truncate">{exam.title}</h3>
                          <Badge className="bg-gradient-to-r from-teal-500 to-blue-600 text-white border-0 shadow-md flex-shrink-0">
                            {exam.examcode}
                          </Badge>
                          {exam.subject && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 flex-shrink-0">
                              {exam.subject}
                            </Badge>
                          )}
                          <Badge className={`${statusConfig[exam.status as keyof typeof statusConfig]?.color || 'bg-gray-100 text-gray-700'} flex-shrink-0`}>
                            {statusConfig[exam.status as keyof typeof statusConfig]?.label || exam.status}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mt-1">{exam.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-4 text-teal-600" />
                        Start: {new Date(exam.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })} {new Date(exam.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="size-4 text-teal-600" />
                        {exam.duration_minutes} min
                      </div>
                    </div>
                  </div>

                  {/* Bottom Section - Stats and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Total Students and Max Attempts */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        Total Students: <span className="font-medium text-teal-700">{exam.totalStudents}</span>
                      </span>
                      <span className="text-gray-600">
                        Max Attempts: <span className="font-medium text-teal-700">{exam.max_attempt}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-nowrap gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-teal-300 text-teal-700 hover:bg-teal-50 whitespace-nowrap"
                        onClick={() => {
                          setSelectedExam(exam);
                          setShowSettingsModal(true);
                        }}
                      >
                        <Settings className="size-4 mr-2" />
                        Settings
                      </Button>
                      {exam.status === 'completed' || exam.status === 'ongoing' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          onClick={() => {
                            // setSelectedExam(exam);
                            // setShowResultsModal(true);
                            navigate(`/teacher/exams/results`);
                          }}
                        >
                          <BarChart3 className="size-4 mr-2" />
                          View Results
                        </Button>
                      ) : null}
                      {/* <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                        onClick={() => {
                          setSelectedExam(exam);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="size-4 mr-2" />
                        Details
                      </Button> */}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredExams.length === 0 && (
        <Card className="shadow-lg rounded-2xl border-0">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No exams found matching your filters</p>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showDetailsModal && selectedExam && (
        <ExamDetailsModal
          exam={selectedExam}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
      {showSettingsModal && selectedExam && (
        <ExamSettingsModal
          exam={selectedExam}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showResultsModal && selectedExam && (
        <ExamResultsModal
          exam={selectedExam}
          onClose={() => setShowResultsModal(false)}
        />
      )}
    </div>
  );
}