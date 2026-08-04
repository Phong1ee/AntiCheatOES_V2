import { useState, useEffect } from 'react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { GeneralInfoTab } from './tabs/GeneralInfoTab';
import { QuestionsTab } from './tabs/QuestionsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { AssignmentTab } from './tabs/AssignmentTab';
import { FileText, BookOpen, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import type { ExamStatus, ResultVisibility, TeacherSubject } from '../../../types/teacher-exam';

interface ExamEditorProps {
  examId: string | null;
  exam: {
    id: string;
    title: string;
    description?: string;
    subject: string;
    subjectId: string;
    status: ExamStatus;
    startTime: string;
    endTime: string;
    duration?: number;
    examCode: string | null;
    maxAttempt: number;
    passingScore: number;
    resultVisibility: ResultVisibility;
  } | null;
  subjects: TeacherSubject[];
  initialTab?: 'general' | 'settings';
  onClose: () => void;
  onSave: (examData: {
    id: string;
    title: string;
    description: string;
    subjectId: string;
    duration: number;
    examCode: string | null;
    maxAttempt: number;
    passingScore: number;
    startTime: string;
    endTime: string;
    status: ExamStatus;
    resultVisibility: ResultVisibility;
  }) => Promise<void>;
  onResultVisibilityChange: (examId: string, resultVisibility: ResultVisibility) => Promise<void>;
}

type ExamEditorTab = 'general' | 'questions' | 'settings' | 'assignment';

const isExamEditorTab = (value: string): value is ExamEditorTab =>
  value === 'general' || value === 'questions' || value === 'settings' || value === 'assignment';

export function ExamEditor({ examId, exam, subjects, initialTab, onClose, onSave, onResultVisibilityChange }: ExamEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [duration, setDuration] = useState(60);
  const [examCode, setExamCode] = useState('');
  const [requireExamCode, setRequireExamCode] = useState(false);
  const [maxAttempt, setMaxAttempt] = useState(1);
  const [passingScore, setPassingScore] = useState(5);
  const [status, setStatus] = useState<ExamStatus>('draft');
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>('hidden');
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<ExamEditorTab>('general');
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
      setDuration(60);
      setExamCode('');
      setRequireExamCode(false);
      setMaxAttempt(1);
      setPassingScore(5);
      setStatus('draft');
      setResultVisibility('hidden');
      setStartDate('');
      setStartClock('');
      setEndDate('');
      setEndClock('');
      setActiveTab('general');
      return;
    }

    if (examId.startsWith('new-')) {
      // Creating new exam - use empty template with generated code
      setTitle('');
      setDescription('');
      setSubject('');
      setSubjectId('');
      setDuration(60);
      setExamCode(generateExamCode());
      setRequireExamCode(true);
      setMaxAttempt(1);
      setPassingScore(5);
      setStatus('draft');
      setResultVisibility('hidden');
      setStartDate('');
      setStartClock('');
      setEndDate('');
      setEndClock('');
      setActiveTab('general');
    } else {
      if (exam) {
        setTitle(exam.title);
        setDescription(exam.description || '');
        setSubject(exam.subject || '');
        setSubjectId(exam.subjectId || '');
        setDuration(exam.duration || 60);
        setExamCode(exam.examCode ?? '');
        setRequireExamCode(exam.examCode !== null);
        setMaxAttempt(exam.maxAttempt);
        setPassingScore(exam.passingScore);
        setStatus(exam.status);
        setResultVisibility(exam.resultVisibility);
        const [savedStartDate = '', savedStartTime = ''] = exam.startTime.split('T');
        const [savedEndDate = '', savedEndTime = ''] = exam.endTime.split('T');
        setStartDate(savedStartDate);
        setStartClock(savedStartTime.slice(0, 5));
        setEndDate(savedEndDate);
        setEndClock(savedEndTime.slice(0, 5));
        setActiveTab(initialTab ?? 'general');
      }
    }
  }, [examId, exam, initialTab]);

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
    published: { label: 'Published', color: 'bg-green-100 text-green-700' },
  } as const;

  // Handle Save
  const handleSave = async () => {
    const startTime = startDate && startClock ? `${startDate}T${startClock}:00` : '';
    const endTime = endDate && endClock ? `${endDate}T${endClock}:00` : '';
    if (!startTime || !endTime) {
      setSaveError('Start date/time and end date/time are required.');
      return;
    }
    if (endTime <= startTime) {
      setSaveError('End date and time must be later than start date and time.');
      return;
    }
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 10) {
      setSaveError('Passing score must be between 0 and 10.');
      return;
    }
    const normalizedExamCode = examCode.trim();
    if (requireExamCode && !normalizedExamCode) {
      setSaveError('Exam code is required when code protection is enabled.');
      return;
    }
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSave({
        id: examId,
        title,
        description,
        subjectId,
        duration,
        examCode: requireExamCode ? normalizedExamCode : null,
        maxAttempt,
        passingScore,
        startTime,
        endTime,
        status,
        resultVisibility,
      });
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
  const scoresAreValid = Number.isFinite(passingScore)
    && passingScore >= 0
    && passingScore <= 10;
  const scheduleIsValid = Boolean(startDate && startClock && endDate && endClock)
    && `${endDate}T${endClock}` > `${startDate}T${startClock}`;
  const hasRequiredData = title.trim() !== ''
    && subjectId !== ''
    && (!requireExamCode || examCode.trim() !== '')
    && scoresAreValid
    && scheduleIsValid;

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
            {!isNewExam && (subject || duration || (requireExamCode && examCode)) && (
              <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-gray-600">
                {subject && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-4 text-teal-600" />
                    <span>{subject}</span>
                  </div>
                )}
                {duration > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-4 text-amber-600" />
                    <span>{duration} minutes</span>
                  </div>
                )}
                {requireExamCode && examCode && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="size-4 text-purple-600" />
                    <span className="font-mono">{examCode}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={status} onValueChange={(value) => {
              if (value === 'draft' || value === 'published') setStatus(value);
            }}>
              <SelectTrigger className={`w-36 ${statusConfig[status].color}`} aria-label="Exam status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="text-xs text-gray-500">
          Auto-saved {getTimeSinceLastSave()}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => {
        if (isExamEditorTab(value)) setActiveTab(value);
      }} className="flex-1 flex flex-col">
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
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="general" className="m-0 p-6">
            <GeneralInfoTab
              subject={subject}
              subjectId={subjectId}
              subjects={subjects}
              examCode={examCode}
              requireExamCode={requireExamCode}
              duration={duration}
              maxAttempt={maxAttempt}
              passingScore={passingScore}
              startDate={startDate}
              startTime={startClock}
              endDate={endDate}
              endTime={endClock}
              onSubjectChange={(nextSubjectId) => {
                setSubjectId(nextSubjectId);
                setSubject(subjects.find((item) => item.subject_id === nextSubjectId)?.subject_name ?? '');
              }}
              onExamCodeChange={setExamCode}
              onRequireExamCodeChange={(required) => {
                setRequireExamCode(required);
                setSaveError(null);
                if (!required) setExamCode('');
                else if (!examCode.trim()) setExamCode(generateExamCode());
              }}
              onDurationChange={setDuration}
              onMaxAttemptChange={setMaxAttempt}
              onPassingScoreChange={setPassingScore}
              onStartDateChange={setStartDate}
              onStartTimeChange={setStartClock}
              onEndDateChange={setEndDate}
              onEndTimeChange={setEndClock}
              canSave={hasRequiredData}
              isSaving={isSaving}
              isNewExam={isNewExam}
              saveError={saveError}
              onCancel={onClose}
              onSave={() => void handleSave()}
            />
          </TabsContent>

          <TabsContent value="questions" className="m-0 p-0">
            <QuestionsTab examId={examId} subjectId={subjectId} />
          </TabsContent>

          <TabsContent value="settings" className="m-0 p-6">
            <SettingsTab
              examId={examId}
              resultVisibility={resultVisibility}
              onResultVisibilityChange={async (nextVisibility) => {
                await onResultVisibilityChange(examId, nextVisibility);
                setResultVisibility(nextVisibility);
              }}
            />
          </TabsContent>

          <TabsContent value="assignment" className="m-0 p-6">
            <AssignmentTab examId={examId} />
          </TabsContent>

        </div>
      </Tabs>

    </div>
  );
}
