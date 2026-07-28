import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Search,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  PenTool,
} from 'lucide-react';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { ExamResultSummary } from '../../../types/teacher-results';

interface ExamListViewProps {
  onSelectExam: (examId: string) => void;
}

export function ExamListView({ onSelectExam }: ExamListViewProps) {
  const [exams, setExams] = useState<ExamResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService
      .listExams()
      .then((data) => {
        if (!cancelled) setExams(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exams');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subjects = Array.from(new Set(exams.map((exam) => exam.subject)));

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.examName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjectFilter === 'all' || exam.subject === subjectFilter;
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    return matchesSearch && matchesSubject && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="size-3 mr-1" />
            Completed
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Clock className="size-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
            <Calendar className="size-3 mr-1" />
            Scheduled
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Subject Filter */}
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div className="space-y-4">
        {loading && (
          <Card className="shadow-md rounded-2xl border-0">
            <CardContent className="p-12 text-center text-gray-500">Loading exams...</CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="shadow-md rounded-2xl border-0">
            <CardContent className="p-12 text-center">
              <AlertCircle className="size-12 text-red-300 mx-auto mb-4" />
              <h3 className="text-gray-600 mb-2">Failed to load exams</h3>
              <p className="text-sm text-gray-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filteredExams.map((exam) => (
          <Card
            key={exam.id}
            className="shadow-md rounded-2xl border-0 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => onSelectExam(exam.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Exam Info */}
                <div className="flex-1 space-y-3">
                  {/* Title and Status */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg text-gray-800 group-hover:text-teal-600 transition-colors">
                        {exam.examName}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{exam.subject}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {getStatusBadge(exam.status)}
                      {exam.hasEssayQuestions && exam.pendingEssayCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          <PenTool className="size-3 mr-1" />
                          {exam.pendingEssayCount} Essay{exam.pendingEssayCount > 1 ? 's' : ''} Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="size-4 text-teal-600" />
                      <span>{formatDate(exam.date)}</span>
                    </div>

                    {/* Duration */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="size-4 text-teal-600" />
                      <span>{exam.duration ?? '-'} mins</span>
                    </div>

                    {/* Questions */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="size-4 text-teal-600" />
                      <span>{exam.totalQuestions} questions</span>
                    </div>

                    {/* Students */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="size-4 text-teal-600" />
                      <span>
                        {exam.submittedCount}/{exam.totalStudents} submitted
                      </span>
                    </div>
                  </div>

                  {/* Average Score */}
                  {exam.status === 'completed' && (
                    <div className="flex items-center gap-2 pt-2">
                      <TrendingUp className="size-4 text-green-600" />
                      <span className="text-sm text-gray-600">Average Score:</span>
                      <span className="text-green-700">{exam.avgScore.toFixed(1)}%</span>
                    </div>
                  )}
                </div>

                {/* Right: Arrow */}
                <div className="flex items-center">
                  <ChevronRight className="size-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && !error && filteredExams.length === 0 && (
          <Card className="shadow-md rounded-2xl border-0">
            <CardContent className="p-12 text-center">
              <FileText className="size-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-gray-600 mb-2">No exams found</h3>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
