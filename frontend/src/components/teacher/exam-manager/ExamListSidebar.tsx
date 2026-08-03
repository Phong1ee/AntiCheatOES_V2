import { useEffect, useMemo, useState, type MouseEvent } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Copy,
  Send,
  FilePenLine,
  Trash2,
  Clock,
  Users,
  FileText,
} from 'lucide-react';
import type { ExamStatus } from '../../../types/teacher-exam';

interface Exam {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  status: ExamStatus;
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
  published: { label: 'Published', color: 'bg-green-100 text-green-700 border-green-200' },
};

interface ExamListSidebarProps {
  exams: Exam[];
  selectedExamId: string | null;
  onSelectExam: (id: string | null) => void;
  onCreateNew: () => void;
  onDeleteExam: (id: string) => Promise<void>;
  onDuplicateExam: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: ExamStatus) => Promise<void>;
}

type ExamOperation = 'duplicate' | 'publish' | 'draft';

export function ExamListSidebar({ exams, selectedExamId, onSelectExam, onCreateNew, onDeleteExam, onDuplicateExam, onStatusChange }: ExamListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeOperation, setActiveOperation] = useState<{ examId: string; operation: ExamOperation } | null>(null);

  const subjectOptions = useMemo(() => {
    const uniqueSubjects = new Map<string, string>();
    exams.forEach((exam) => {
      if (exam.subjectId && !uniqueSubjects.has(exam.subjectId)) uniqueSubjects.set(exam.subjectId, exam.subject);
    });
    return Array.from(uniqueSubjects, ([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [exams]);

  useEffect(() => {
    if (filterSubject !== 'all' && !subjectOptions.some((subject) => subject.id === filterSubject)) {
      setFilterSubject('all');
    }
  }, [filterSubject, subjectOptions]);

  const runOperation = async (event: MouseEvent, exam: Exam, operation: ExamOperation) => {
    event.stopPropagation();
    if (activeOperation || isDeleting) return;
    try {
      setActiveOperation({ examId: exam.id, operation });
      if (operation === 'duplicate') {
        await onDuplicateExam(exam.id);
        setSearchQuery('');
        setFilterStatus('all');
        setFilterSubject('all');
      } else {
        const status: ExamStatus = operation === 'publish' ? 'published' : 'draft';
        await onStatusChange(exam.id, status);
        setFilterStatus('all');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the exam.');
    } finally {
      setActiveOperation(null);
    }
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteExam(examToDelete.id);
      setExamToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete the exam.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredExams = exams
    .filter((exam) => filterStatus === 'all' || exam.status === filterStatus)
    .filter((exam) => filterSubject === 'all' || exam.subjectId === filterSubject)
    .filter((exam) =>
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase())
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
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjectOptions.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
              ))}
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
              const isBusy = activeOperation?.examId === exam.id;

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
                          <button disabled={Boolean(activeOperation) || isDeleting} className="p-1 hover:bg-gray-200 rounded disabled:opacity-50">
                            <MoreVertical className="size-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={Boolean(activeOperation) || isDeleting} onClick={(event) => void runOperation(event, exam, 'duplicate')}>
                            <Copy className="size-4 mr-2" />
                            {isBusy && activeOperation.operation === 'duplicate' ? 'Duplicating...' : 'Duplicate'}
                          </DropdownMenuItem>
                          {exam.status !== 'published' && (
                            <DropdownMenuItem disabled={Boolean(activeOperation) || isDeleting} onClick={(event) => void runOperation(event, exam, 'publish')}>
                              <Send className="size-4 mr-2" />
                              {isBusy && activeOperation.operation === 'publish' ? 'Publishing...' : 'Publish'}
                            </DropdownMenuItem>
                          )}
                          {exam.status !== 'draft' && (
                            <DropdownMenuItem disabled={Boolean(activeOperation) || isDeleting} onClick={(event) => void runOperation(event, exam, 'draft')}>
                              <FilePenLine className="size-4 mr-2" />
                              {isBusy && activeOperation.operation === 'draft' ? 'Updating...' : 'Set as Draft'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={Boolean(activeOperation) || isDeleting} className="text-red-600" onClick={(event) => { event.stopPropagation(); setExamToDelete(exam); }}>
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Subject */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">
                        {exam.subject}
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
      <AlertDialog open={examToDelete !== null} onOpenChange={(open) => { if (!open && !isDeleting) setExamToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the exam and its attempts, but keeps reusable question-bank questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Deleting...' : 'Delete exam'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
