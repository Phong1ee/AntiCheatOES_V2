import { useState } from 'react';
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
} from 'lucide-react';
import { Input } from '../ui/input';
import { ExamDetailsModal } from './ExamDetailsModal';
import { ExamSettingsModal } from './ExamSettingsModal';
import { ExamResultsModal } from './ExamResultsModal';

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

const mockExams: Exam[] = [
  {
    id: '1',
    title: 'Midterm Exam',
    subject: 'Database Systems',
    date: '2025-11-20',
    time: '09:00 AM',
    duration: 90,
    totalStudents: 45,
    completedStudents: 0,
    averageScore: null,
    status: 'upcoming',
  },
  {
    id: '2',
    title: 'Quiz 3',
    subject: 'Web Development',
    date: '2025-11-15',
    time: '02:00 PM',
    duration: 30,
    totalStudents: 38,
    completedStudents: 35,
    averageScore: 82.5,
    status: 'ongoing',
  },
  {
    id: '3',
    title: 'Final Exam',
    subject: 'Data Structures',
    date: '2025-11-10',
    time: '10:00 AM',
    duration: 120,
    totalStudents: 52,
    completedStudents: 52,
    averageScore: 76.8,
    status: 'completed',
  },
  {
    id: '4',
    title: 'Quiz 2',
    subject: 'Database Systems',
    date: '2025-11-08',
    time: '09:00 AM',
    duration: 45,
    totalStudents: 45,
    completedStudents: 45,
    averageScore: 88.3,
    status: 'completed',
  },
  {
    id: '5',
    title: 'Midterm Exam',
    subject: 'Web Development',
    date: '2025-11-25',
    time: '01:00 PM',
    duration: 90,
    totalStudents: 38,
    completedStudents: 0,
    averageScore: null,
    status: 'upcoming',
  },
];

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
  const [sortBy, setSortBy] = useState<string>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const filteredExams = mockExams
    .filter((exam) => filterStatus === 'all' || exam.status === filterStatus)
    .filter((exam) =>
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
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
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="subject">Sort by Subject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div className="grid gap-4">
        {filteredExams.map((exam) => {
          const config = statusConfig[exam.status];
          return (
            <Card key={exam.id} className="shadow-lg rounded-2xl border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                  {/* Exam Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg text-gray-800">{exam.title}</h3>
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mt-1">{exam.subject}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-4 text-teal-600" />
                        {new Date(exam.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="size-4 text-teal-600" />
                        {exam.time} ({exam.duration} min)
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        Students: {exam.completedStudents}/{exam.totalStudents}
                      </span>
                      {exam.averageScore !== null && (
                        <span className="text-gray-600">
                          Avg Score: <span className="font-medium text-teal-700">{exam.averageScore.toFixed(1)}%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-teal-300 text-teal-700 hover:bg-teal-50"
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
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setSelectedExam(exam);
                          setShowResultsModal(true);
                        }}
                      >
                        <BarChart3 className="size-4 mr-2" />
                        View Results
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedExam(exam);
                        setShowDetailsModal(true);
                      }}
                    >
                      <Eye className="size-4 mr-2" />
                      Details
                    </Button>
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