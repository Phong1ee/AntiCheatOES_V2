import { useState, useEffect } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { GeneralInfoTab } from './tabs/GeneralInfoTab';
import { QuestionsTab } from './tabs/QuestionsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { AssignmentTab } from './tabs/AssignmentTab';
import { PreviewTab } from './tabs/PreviewTab';
import { Save, ChevronDown, Eye, Calendar, Send, FileText, BookOpen, Users, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import type { TeacherSubject } from '../../../types/teacher-exam';

interface ExamEditorProps {
  examId: string | null;
  exam: {
    id: string;
    title: string;
    description?: string;
    subject: string;
    subjectId: string;
    class: string;
    status: 'draft' | 'scheduled' | 'published' | 'archived';
    duration?: number;
    examCode?: string;
    maxAttempt: number;
  } | null;
  subjects: TeacherSubject[];
  onClose: () => void;
  onSave: (examData: {
    id: string;
    title: string;
    description: string;
    subjectId: string;
    duration: number;
    examCode: string;
    maxAttempt: number;
  }) => Promise<void>;
}

export function ExamEditor({ examId, exam, subjects, onClose, onSave }: ExamEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classGroup, setClassGroup] = useState('');
  const [duration, setDuration] = useState(60);
  const [examCode, setExamCode] = useState('');
  const [maxAttempt, setMaxAttempt] = useState(1);
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Generate unique exam code for new exams
  const generateExamCode = () => {
    return 'EXAM-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  // Load exam data when examId changes
  useEffect(() => {
    // Scroll to top when exam changes
    const editorElement = document.querySelector('.exam-editor-container');
    if (editorElement) {
      editorElement.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (!examId) {
      // No exam selected - reset form
      setTitle('');
      setDescription('');
      setSubject('');
      setSubjectId('');
      setClassGroup('');
      setDuration(60);
      setExamCode('');
      setMaxAttempt(1);
      setStatus('draft');
      setActiveTab('general');
      return;
    }

    if (examId.startsWith('new-')) {
      // Creating new exam - use empty template with generated code
      setTitle('');
      setDescription('');
      setSubject('');
      setSubjectId('');
      setClassGroup('');
      setDuration(60);
      setExamCode(generateExamCode());
      setMaxAttempt(1);
      setStatus('draft');
      setActiveTab('general');
    } else {
      if (exam) {
        setTitle(exam.title);
        setDescription(exam.description || '');
        setSubject(exam.subject || '');
        setSubjectId(exam.subjectId || '');
        setClassGroup(exam.class || '');
        setDuration(exam.duration || 60);
        setExamCode(exam.examCode || generateExamCode());
        setMaxAttempt(exam.maxAttempt);
        setStatus(exam.status);
        setActiveTab('general');
      }
    }
  }, [examId, exam]);

  // Auto-save simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLastSaved(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!examId) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center max-w-md px-6">
          <div className="mb-6 inline-flex p-6 bg-white rounded-2xl shadow-lg">
            <FileText className="size-16 text-gray-300" />
          </div>
          <h3 className="text-xl text-gray-800 mb-2">No Exam Selected</h3>
          <p className="text-gray-600 mb-6">
            Select an exam from the list on the left to view and edit its details,
            or create a new exam to get started.
          </p>
          <div className="flex items-center gap-2 justify-center text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="size-2 bg-teal-500 rounded-full" />
              <span>Click an exam to edit</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-2">
              <div className="size-2 bg-blue-500 rounded-full" />
              <span>Or create new</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isNewExam = examId.startsWith('new-');

  const getTimeSinceLastSave = () => {
    const seconds = Math.floor((new Date().getTime() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
    published: { label: 'Published', color: 'bg-green-100 text-green-700' },
    archived: { label: 'Archived', color: 'bg-amber-100 text-amber-700' },
  } as const;

  // Handle Save
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSave({ id: examId, title, description, subjectId, duration, examCode, maxAttempt });
      setLastSaved(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the exam.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if has unsaved changes
  const hasRequiredData = title.trim() !== '' && subjectId !== '' && examCode.trim() !== '';

  return (
    <div className="h-full flex flex-col bg-white relative exam-editor-container">
      {/* New Exam Indicator */}
      {isNewExam && (
        <div className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
          <FileText className="size-4" />
          <span>Creating New Exam - Fill in the details below</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 p-4 space-y-4">
        {/* Title & Actions */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
            <div
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: '85px minmax(0, 1fr)' }}
            >
              <label
                htmlFor="exam-title"
                className="inline-flex w-full justify-end rounded px-2 py-0.5 text-sm font-medium text-black-600 font-bold"
              >
                Exam Title
              </label>
              <Input
                id="exam-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter exam title..."
                className="w-full min-w-0 text-2xl border-0 px-3 focus-visible:ring-0"
              />
            </div>
            <div
              className="grid items-start gap-3"
              style={{ gridTemplateColumns: '85px minmax(0, 1fr)' }}
            >
              <label
                htmlFor="exam-description"
                className="inline-flex w-full justify-end rounded px-2 py-0.5 text-sm font-medium text-black-600 font-bold"
              >
                Description
              </label>
              <Textarea
                id="exam-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description or instructions..."
                className="w-full min-w-0 resize-none text-sm border-0 px-3 focus-visible:ring-0"
                rows={2}
              />
            </div>
            
            {/* Exam Info Bar - Only show for existing exams with data */}
            {!isNewExam && (subject || classGroup || duration || examCode) && (
              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-gray-600">
                {subject && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-4 text-teal-600" />
                    <span>{subject}</span>
                  </div>
                )}
                {classGroup && (
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4 text-blue-600" />
                    <span>{classGroup}</span>
                  </div>
                )}
                {duration > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-4 text-amber-600" />
                    <span>{duration} minutes</span>
                  </div>
                )}
                {examCode && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="size-4 text-purple-600" />
                    <span className="font-mono">{examCode}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className={statusConfig[status].color}>
              {statusConfig[status].label}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700">
                  <Save className="size-4 mr-2" />
                  Publish
                  <ChevronDown className="size-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatus('draft')}>
                  <Save className="size-4 mr-2" />
                  Save as Draft
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Eye className="size-4 mr-2" />
                  Save & Preview
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatus('scheduled')}>
                  <Calendar className="size-4 mr-2" />
                  Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus('published')}>
                  <Send className="size-4 mr-2" />
                  Publish Now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="text-xs text-gray-500">
          Auto-saved {getTimeSinceLastSave()}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="general"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent"
          >
            General Info
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent"
          >
            Questions
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent"
          >
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="assignment"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent"
          >
            Assignment
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent"
          >
            Preview & Test
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="general" className="m-0 p-6">
            <GeneralInfoTab
              subject={subject}
              subjectId={subjectId}
              subjects={subjects}
              classGroup={classGroup}
              examCode={examCode}
              duration={duration}
              maxAttempt={maxAttempt}
              onSubjectChange={(nextSubjectId) => {
                setSubjectId(nextSubjectId);
                setSubject(subjects.find((item) => item.subject_id === nextSubjectId)?.subject_name ?? '');
              }}
              onClassGroupChange={setClassGroup}
              onExamCodeChange={setExamCode}
              onDurationChange={setDuration}
              onMaxAttemptChange={setMaxAttempt}
            />
          </TabsContent>

          <TabsContent value="questions" className="m-0 p-0">
            <QuestionsTab examId={examId} subjectId={subjectId} />
          </TabsContent>

          <TabsContent value="settings" className="m-0 p-6">
            <SettingsTab examId={examId} />
          </TabsContent>

          <TabsContent value="assignment" className="m-0 p-6">
            <AssignmentTab examId={examId} />
          </TabsContent>

          <TabsContent value="preview" className="m-0 p-6">
            <PreviewTab
              examId={examId}
              title={title}
              description={description}
              subject={subject}
              classGroup={classGroup}
              duration={duration}
              examCode={examCode}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Sticky Save Button */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasRequiredData ? (
              <span className="flex items-center gap-2">
                <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                Ready to save
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-600">
                <div className="size-2 bg-amber-500 rounded-full" />
                Please fill in title, subject, and class
              </span>
            )}
          </div>
          {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasRequiredData || isSaving}
              className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="size-4 mr-2" />
              {isSaving ? 'Saving...' : isNewExam ? 'Create Exam' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
