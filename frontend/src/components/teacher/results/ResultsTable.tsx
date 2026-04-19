import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
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
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from 'lucide-react';

interface StudentResult {
  id: string;
  studentId: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: string; // in format "18m 23s"
  status: 'submitted' | 'not-submitted' | 'late';
  submittedAt?: string;
}

const mockResults: StudentResult[] = [
  {
    id: '1',
    studentId: 'ST001',
    name: 'Alice Johnson',
    score: 95,
    correctAnswers: 19,
    totalQuestions: 20,
    timeSpent: '18m 23s',
    status: 'submitted',
    submittedAt: '2025-11-14T10:30:00',
  },
  {
    id: '2',
    studentId: 'ST002',
    name: 'Bob Smith',
    score: 88,
    correctAnswers: 17,
    totalQuestions: 20,
    timeSpent: '22m 15s',
    status: 'submitted',
    submittedAt: '2025-11-14T11:15:00',
  },
  {
    id: '3',
    studentId: 'ST003',
    name: 'Carol Williams',
    score: 76,
    correctAnswers: 15,
    totalQuestions: 20,
    timeSpent: '25m 40s',
    status: 'late',
    submittedAt: '2025-11-14T14:20:00',
  },
  {
    id: '4',
    studentId: 'ST004',
    name: 'David Brown',
    score: 0,
    correctAnswers: 0,
    totalQuestions: 20,
    timeSpent: '-',
    status: 'not-submitted',
  },
  {
    id: '5',
    studentId: 'ST005',
    name: 'Emma Davis',
    score: 92,
    correctAnswers: 18,
    totalQuestions: 20,
    timeSpent: '20m 08s',
    status: 'submitted',
    submittedAt: '2025-11-14T10:45:00',
  },
];

const statusConfig = {
  submitted: { label: 'Submitted', color: 'bg-green-100 text-green-700' },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-700' },
  'not-submitted': { label: 'Not Submitted', color: 'bg-red-100 text-red-700' },
};

type SortField = 'name' | 'score' | 'timeSpent' | 'status';
type SortOrder = 'asc' | 'desc' | null;

interface ResultsTableProps {
  onViewDetail: (studentId: string) => void;
}

export function ResultsTable({ onViewDetail }: ResultsTableProps) {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === mockResults.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(mockResults.map((r) => r.id));
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

  return (
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
                <Button variant="outline" size="sm">
                  <Download className="size-4 mr-2" />
                  Export Selected
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="size-4 mr-2" />
                  Send Email
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
                      mockResults.length > 0 &&
                      selectedStudents.length === mockResults.length
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
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort('score')}
                    className="flex items-center gap-2 mx-auto hover:text-teal-600"
                  >
                    Score
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
              {mockResults.map((result) => {
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
                        {result.status !== 'not-submitted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewDetail(result.id)}
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
                            {result.status !== 'not-submitted' && (
                              <DropdownMenuItem onClick={() => onViewDetail(result.id)}>
                                <Eye className="size-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="size-4 mr-2" />
                              Export Result
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="size-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
