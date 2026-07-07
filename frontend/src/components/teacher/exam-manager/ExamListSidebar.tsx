import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  Eye,
  Share2,
  Download,
  Archive,
  Trash2,
  Clock,
  Users,
  FileText,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  class: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  date: string;
  questionCount: number;
  assignedStudents: number;
  averageScore: number | null;
  duration?: number;
  examCode?: string;
  description?: string;
}

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700 border-green-200' },
  archived: { label: 'Archived', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

interface ExamListSidebarProps {
  exams: Exam[];
  selectedExamId: string | null;
  onSelectExam: (id: string | null) => void;
  onCreateNew: () => void;
}

export function ExamListSidebar({ exams, selectedExamId, onSelectExam, onCreateNew }: ExamListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  const filteredExams = exams
    .filter((exam) => filterStatus === 'all' || exam.status === filterStatus)
    .filter((exam) => filterSubject === 'all' || exam.subject === filterSubject)
    .filter((exam) =>
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.class.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <Button
          onClick={onCreateNew}
          className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
        >
          <Plus className="size-4 mr-2" />
          Create New Exam
        </Button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1 text-xs">
              <Filter className="size-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Database Systems">Database Systems</SelectItem>
              <SelectItem value="Web Development">Web Development</SelectItem>
              <SelectItem value="Data Structures">Data Structures</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Exam List */}
      <div className="flex-1 overflow-y-auto">
        {filteredExams.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No exams found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredExams.map((exam) => {
              const config = statusConfig[exam.status];
              const isSelected = selectedExamId === exam.id;

              return (
                <div
                  key={exam.id}
                  onClick={() => onSelectExam(exam.id)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    isSelected ? 'bg-teal-50 border-l-4 border-teal-500' : ''
                  }`}
                >
                  <div className="space-y-2">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm text-gray-800 line-clamp-2 flex-1">{exam.title}</h4>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 hover:bg-gray-200 rounded">
                            <MoreVertical className="size-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="size-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="size-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Share2 className="size-4 mr-2" />
                            Assign to Class
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="size-4 mr-2" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Archive className="size-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Subject & Class */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">
                        {exam.subject} • {exam.class}
                      </span>
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="size-3" />
                        {exam.questionCount} Q
                      </div>
                      {exam.assignedStudents > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="size-3" />
                          {exam.assignedStudents}
                        </div>
                      )}
                    </div>

                    {/* Average Score */}
                    {exam.averageScore !== null && (
                      <div className="text-xs">
                        <span className="text-gray-600">Avg: </span>
                        <span className="text-teal-700">{exam.averageScore.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}