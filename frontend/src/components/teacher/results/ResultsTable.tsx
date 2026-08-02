import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import { LoadingState } from '../common/LoadingState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Eye,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  X,
  History,
  Trophy,
  Clock,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { teacherResultsService, downloadCsv } from '../../../services/teacher-results.service';
import type { StudentResult } from '../../../types/teacher-results';
import type { ResultsFilterValue } from './ResultsFilter';

const statusConfig: Record<StudentResult['status'], { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'bg-green-100 text-green-700' },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-700' },
  'not-submitted': { label: 'Not Submitted', color: 'bg-red-100 text-red-700' },
};

type SortField = 'name' | 'score' | 'timeSpent' | 'status';
type SortOrder = 'asc' | 'desc' | null;

interface ResultsTableProps {
  examId: number;
  examName: string;
  refreshKey: number;
  filters: ResultsFilterValue;
  onViewDetail: (attemptId: number) => void;
}

const CSV_HEADERS = ['Student ID', 'Name', 'Final Score', 'Correct Answers', 'Total Questions', 'Time Spent', 'Status', 'Submitted At'];

function toCsvRow(result: StudentResult): (string | number)[] {
  return [
    result.studentId,
    result.name,
    result.score,
    result.correctAnswers,
    result.totalQuestions,
    result.timeSpent,
    statusConfig[result.status].label,
    result.submittedAt ?? '',
  ];
}

interface AttemptsModalProps {
  result: StudentResult;
  onClose: () => void;
  onViewAttempt: (attemptId: number) => void;
}

function AttemptsModal({ result, onClose, onViewAttempt }: AttemptsModalProps) {
  const finalAttemptId = result.attemptId;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <History className="size-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-gray-800 text-base">{result.name}</h2>
              <p className="text-xs text-gray-500">
                {result.studentId} · {result.attempts.length} attempt{result.attempts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Attempts list */}
        <div className="p-5 space-y-3 max-h-[420px] overflow-y-auto">
          {[...result.attempts].reverse().map((attempt) => {
            const isFinal = finalAttemptId === attempt.attemptId;
            return (
              <div
                key={attempt.attemptId}
                className={`rounded-xl border p-4 ${isFinal ? 'border-teal-200 bg-teal-50/50' : 'border-gray-100 bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Attempt badge */}
                    <div className={`size-9 rounded-full flex items-center justify-center text-sm font-medium ${isFinal ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {attempt.attemptNumber ?? '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Attempt {attempt.attemptNumber ?? '?'}</span>
                        {isFinal && (
                          <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                            <Trophy className="size-3" />
                            Final
                          </span>
                        )}
                        {attempt.status === 'late' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Late</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {attempt.submittedAt
                          ? new Date(attempt.submittedAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : 'Not submitted'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Stats */}
                    <div className="text-right">
                      <p className={`text-lg font-medium ${attempt.score >= 90 ? 'text-green-600' : attempt.score >= 75 ? 'text-blue-600' : attempt.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {attempt.score}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="size-3" />
                          {attempt.correctAnswers}/{attempt.totalQuestions}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {attempt.timeSpent}
                        </span>
                      </div>
                    </div>

                    {/* View button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => { onViewAttempt(attempt.attemptId); onClose(); }}
                    >
                      <Eye className="size-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResultsTable({ examId, examName, refreshKey, filters, onViewDetail }: ResultsTableProps) {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [attemptsFor, setAttemptsFor] = useState<StudentResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherResultsService
      .listStudents(examId)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load student results');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, refreshKey]);

  const filteredResults = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return results.filter((result) => {
      const matchesSearch =
        !search ||
        result.name.toLowerCase().includes(search) ||
        result.studentId.toLowerCase().includes(search);
      const matchesStatus = filters.status === 'all' || result.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [results, filters]);

  const sortedResults = useMemo(() => {
    if (!sortField || !sortOrder) return filteredResults;
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...filteredResults].sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name) * direction;
      if (sortField === 'score') return (a.score - b.score) * direction;
      if (sortField === 'status') return a.status.localeCompare(b.status) * direction;
      return a.timeSpent.localeCompare(b.timeSpent) * direction;
    });
  }, [filteredResults, sortField, sortOrder]);

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === sortedResults.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(sortedResults.map((r) => r.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortOrder(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="size-4 text-gray-400" />;
    if (sortOrder === 'asc') return <ArrowUp className="size-4 text-teal-600" />;
    if (sortOrder === 'desc') return <ArrowDown className="size-4 text-teal-600" />;
    return <ArrowUpDown className="size-4 text-gray-400" />;
  };

  const exportSelected = () => {
    const rows = sortedResults.filter((r) => selectedStudents.includes(r.id)).map(toCsvRow);
    downloadCsv(`${examName.replace(/[^a-z0-9_-]+/gi, '_')}_selected_results.csv`, CSV_HEADERS, rows);
  };

  const exportOne = (result: StudentResult) => {
    downloadCsv(`${result.studentId}_result.csv`, CSV_HEADERS, [toCsvRow(result)]);
  };

  if (loading) {
    return (
      <Card className="shadow-md rounded-2xl border-0">
        <CardContent className="p-12">
          <LoadingState variant="inline" label="Loading student results..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-md rounded-2xl border-0">
        <CardContent className="p-12 text-center text-red-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="shadow-md rounded-2xl border-0">
      <CardContent className="p-0">
        {/* Bulk Actions */}
        {selectedStudents.length > 0 && (
          <div className="p-4 bg-teal-50 border-b border-teal-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                {selectedStudents.length} student(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportSelected}>
                  <Download className="size-4 mr-2" />
                  Export Selected
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      sortedResults.length > 0 &&
                      selectedStudents.length === sortedResults.length
                    }
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-teal-600"
                  >
                    Student Name
                    {getSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('score')}
                    className="flex items-center gap-2 mx-auto hover:text-teal-600"
                  >
                    Final Score
                    {getSortIcon('score')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Correct Answers</TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('timeSpent')}
                    className="flex items-center gap-2 mx-auto hover:text-teal-600"
                  >
                    Time Spent
                    {getSortIcon('timeSpent')}
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-2 mx-auto hover:text-teal-600"
                  >
                    Status
                    {getSortIcon('status')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => {
                const statusInfo = statusConfig[result.status];
                return (
                  <TableRow
                    key={result.id}
                    className={`hover:bg-gray-50 ${
                      selectedStudents.includes(result.id) ? 'bg-teal-50' : ''
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedStudents.includes(result.id)}
                        onCheckedChange={() => toggleStudent(result.id)}
                      />
                    </TableCell>
                    <TableCell className="text-gray-600">{result.studentId}</TableCell>
                    <TableCell className="text-gray-800">{result.name}</TableCell>
                    <TableCell className="text-center">
                      {result.attempts.length > 0 ? (
                        <button
                          onClick={() => setAttemptsFor(result)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            result.attempts.length > 1
                              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <History className="size-3" />
                          {result.attempts.length} attempt{result.attempts.length !== 1 ? 's' : ''}
                          {result.attempts.length > 1 && <ChevronRight className="size-3" />}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-12 h-8 rounded-lg ${
                          result.score >= 90
                            ? 'bg-green-100 text-green-700'
                            : result.score >= 75
                            ? 'bg-blue-100 text-blue-700'
                            : result.score >= 60
                            ? 'bg-amber-100 text-amber-700'
                            : result.score > 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {result.score}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-gray-600">
                      {result.correctAnswers}/{result.totalQuestions}
                    </TableCell>
                    <TableCell className="text-center text-gray-600">
                      {result.timeSpent}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {result.attemptId !== null && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewDetail(result.attemptId as number)}
                          >
                            <Eye className="size-4 mr-1" />
                            View
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {result.attemptId !== null && (
                              <DropdownMenuItem onClick={() => onViewDetail(result.attemptId as number)}>
                                <Eye className="size-4 mr-2" />
                                View Best Attempt
                              </DropdownMenuItem>
                            )}
                            {result.attempts.length > 1 && (
                              <DropdownMenuItem onClick={() => setAttemptsFor(result)}>
                                <History className="size-4 mr-2" />
                                View All Attempts
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => exportOne(result)}>
                              <Download className="size-4 mr-2" />
                              Export Result
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    No students match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    {/* Attempts modal */}
    {attemptsFor && (
      <AttemptsModal
        result={attemptsFor}
        onClose={() => setAttemptsFor(null)}
        onViewAttempt={onViewDetail}
      />
    )}
    </>
  );
}
