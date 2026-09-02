import { useEffect, useState } from 'react';
import { normalizeSearchText } from '../../../utils/search';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { LoadingState } from '../common/LoadingState';
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
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  PenTool,
  BookOpen,
  BarChart2,
} from 'lucide-react';
import { teacherResultsService } from '../../../services/teacher-results.service';
import type { ExamResultSummary } from '../../../types/teacher-results';

interface ExamListViewProps {
  onSelectExam: (examId: string) => void;
}

// Color palette cycling through subjects
const SUBJECT_COLORS = [
  {
    border: 'border-l-teal-500',
    icon: 'bg-teal-500',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    border: 'border-l-violet-500',
    icon: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    border: 'border-l-blue-500',
    icon: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    border: 'border-l-rose-500',
    icon: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    border: 'border-l-amber-500',
    icon: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
];

// The card accent (left border + icon) reflects exam status, not subject — status is the more
// actionable signal in a results list. The subject-cycling palette above only drives the small
// subject-name pill now.
const STATUS_ACCENT_COLORS: Record<string, { border: string; icon: string }> = {
  completed: { border: 'border-l-green-500', icon: 'bg-green-500' },
  'in-progress': { border: 'border-l-blue-500', icon: 'bg-blue-500' },
  scheduled: { border: 'border-l-orange-500', icon: 'bg-orange-500' },
};

function getSubjectColor(subject: string, subjects: string[]) {
  const idx = subjects.indexOf(subject);
  return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
}

function scoreColor(avg: number) {
  if (avg >= 85) return 'text-green-600';
  if (avg >= 70) return 'text-blue-600';
  if (avg >= 55) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(avg: number) {
  if (avg >= 85) return 'from-green-400 to-green-600';
  if (avg >= 70) return 'from-blue-400 to-blue-600';
  if (avg >= 55) return 'from-amber-400 to-amber-500';
  return 'from-red-400 to-red-500';
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
      normalizeSearchText(exam.examName).includes(normalizeSearchText(searchQuery)) ||
      normalizeSearchText(exam.subject).includes(normalizeSearchText(searchQuery));
    const matchesSubject = subjectFilter === 'all' || exam.subject === subjectFilter;
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    return matchesSearch && matchesSubject && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border border-green-200">
            <CheckCircle className="size-3 mr-1" />
            Completed
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border border-blue-200">
            <Clock className="size-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border border-gray-200">
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
      <Card className="sticky top-0 z-10 shadow-md rounded-2xl border-0">
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
            <CardContent className="p-12">
              <LoadingState variant="inline" label="Loading exams..." />
            </CardContent>
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

        {!loading && !error && filteredExams.map((exam) => {
          const subjectColor = getSubjectColor(exam.subject, subjects);
          const color = { ...subjectColor, ...STATUS_ACCENT_COLORS[exam.status] };
          const completion = exam.totalStudents > 0
            ? Math.round((exam.submittedCount / exam.totalStudents) * 100)
            : 0;

          return (
            <Card
              key={exam.id}
              className={`shadow-md rounded-2xl border-0 border-l-4 ${color.border} hover:shadow-xl transition-all cursor-pointer group overflow-hidden`}
              onClick={() => onSelectExam(exam.id)}
            >
              <CardContent className="p-0">
                {/* Top strip */}
                <div className="flex items-start gap-5 p-5 pb-4">
                  {/* Subject icon */}
                  <div className={`size-12 ${color.icon} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <BookOpen className="size-6 text-white" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-base text-gray-800 group-hover:text-gray-900 transition-colors leading-snug">
                        {exam.examName}
                      </h3>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {getStatusBadge(exam.status)}
                        {exam.hasEssayQuestions && exam.pendingEssayCount > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs">
                            <PenTool className="size-3 mr-1" />
                            {exam.pendingEssayCount} pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${color.badge}`}>
                      {exam.subject}
                    </span>
                  </div>

                  <ChevronRight className="size-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60">
                  {/* Period */}
                  <div className="flex flex-col items-center justify-center py-3 px-4 gap-1 text-center">
                    <Calendar className="size-4 text-gray-400" />
                    <p className="text-xs text-gray-500">Period</p>
                    <p className="text-xs text-teal-600">{formatDate(exam.date)} {formatTime(exam.date)}</p>
                    <p className="text-xs text-gray-400 leading-none">↓</p>
                    <p className="text-xs text-red-500">{formatDate(exam.endDate)} {formatTime(exam.endDate)}</p>
                  </div>

                  {/* Duration + Questions */}
                  <div className="flex flex-col items-center justify-center py-3 px-4 gap-1">
                    <Clock className="size-4 text-gray-400" />
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-sm text-gray-700">
                      {exam.duration ?? '-'} min · {exam.totalQuestions} Qs
                    </p>
                  </div>

                  {/* Submission */}
                  <div className="flex flex-col items-center justify-center py-3 px-4 gap-1">
                    <Users className="size-4 text-gray-400" />
                    <p className="text-xs text-gray-500">Submitted</p>
                    <p className="text-sm text-gray-700">
                      {exam.submittedCount}/{exam.totalStudents}
                      <span className="text-xs text-gray-400 ml-1">({completion}%)</span>
                    </p>
                  </div>

                  {/* Avg Score */}
                  <div className="flex flex-col items-center justify-center py-3 px-4 gap-1">
                    <BarChart2 className="size-4 text-gray-400" />
                    <p className="text-xs text-gray-500">Avg Score</p>
                    {exam.status === 'completed' ? (
                      <div className="flex items-center gap-2 w-full max-w-[100px]">
                        <p className={`text-sm ${scoreColor(exam.avgScore)}`}>
                          {exam.avgScore.toFixed(2)} / 100
                        </p>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${scoreBarColor(exam.avgScore)} rounded-full`}
                            style={{ width: `${Math.min(exam.avgScore, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">—</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

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
