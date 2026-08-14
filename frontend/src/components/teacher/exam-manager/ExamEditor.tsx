import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
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
import { SectionSaveBar } from './SectionSaveBar';
import { FileText, BookOpen, Clock, Hash, Settings2, Users } from 'lucide-react';
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
    version: number;
  } | null;
  subjects: TeacherSubject[];
  initialTab?: 'general' | 'questions' | 'settings';
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
    expectedVersion?: number;
  }) => Promise<void>;
  onSaved: () => Promise<void>;
  onStatusChange: (examId: string, status: ExamStatus) => Promise<void>;
  onViewInQuestionBank: (questionId: number, tab: 'bank' | 'mine') => void;
  /** Lets the page warn before the teacher navigates away from unsaved work. */
  onDirtyChange?: (dirty: boolean) => void;
}

type ExamEditorTab = 'general' | 'questions' | 'settings' | 'assignment';

const isExamEditorTab = (value: string): value is ExamEditorTab =>
  value === 'general' || value === 'questions' || value === 'settings' || value === 'assignment';

/** Minute precision on both sides so a saved exam never looks permanently edited. */
const scheduleKey = (raw: string) => {
  const [date = '', time = ''] = raw.split('T');
  return date && time ? `${date}T${time.slice(0, 5)}` : '';
};

export function ExamEditor({ examId, exam, subjects, initialTab, onClose, onSave, onSaved, onStatusChange, onViewInQuestionBank, onDirtyChange }: ExamEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [duration, setDuration] = useState(60);
  const [examCode, setExamCode] = useState('');
  const [requireExamCode, setRequireExamCode] = useState(false);
  const [maxAttempt, setMaxAttempt] = useState(1);
  const [passingScore, setPassingScore] = useState(50);
  const [status, setStatus] = useState<ExamStatus>('draft');
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>('hidden');
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [activeTab, setActiveTab] = useState<ExamEditorTab>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedExamIdRef = useRef<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  // Tabs stay mounted once opened so unsaved work survives tab switching.
  const [visitedTabs, setVisitedTabs] = useState<ExamEditorTab[]>(['general']);
  const [sectionDirty, setSectionDirty] = useState({ questions: false, settings: false, assignment: false });

  useEffect(() => {
    setVisitedTabs((current) => current.includes(activeTab) ? current : [...current, activeTab]);
  }, [activeTab]);

  const setDirtyFor = useCallback((section: 'questions' | 'settings' | 'assignment', dirty: boolean) => {
    setSectionDirty((current) => current[section] === dirty ? current : { ...current, [section]: dirty });
  }, []);
  const handleQuestionsDirty = useCallback((dirty: boolean) => setDirtyFor('questions', dirty), [setDirtyFor]);
  const handleSettingsDirty = useCallback((dirty: boolean) => setDirtyFor('settings', dirty), [setDirtyFor]);
  const handleAssignmentDirty = useCallback((dirty: boolean) => setDirtyFor('assignment', dirty), [setDirtyFor]);

  // Status is committed on selection so it is never left as pending unsaved
  // state; this matches the exam list's status menu, which already saves directly.
  const handleStatusSelect = async (nextStatus: ExamStatus) => {
    if (nextStatus === status) return;
    if (!examId || examId.startsWith('new-')) {
      setStatus(nextStatus);
      return;
    }
    try {
      setStatusSaving(true);
      setSaveError(null);
      await onStatusChange(examId, nextStatus);
      setStatus(nextStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change the exam status.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setStatusSaving(false);
    }
  };

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
      loadedExamIdRef.current = null;
      // No exam selected - reset form
      setTitle('');
      setDescription('');
      setSubject('');
      setSubjectId('');
      setDuration(60);
      setExamCode('');
      setRequireExamCode(false);
      setMaxAttempt(1);
      setPassingScore(50);
      setStatus('draft');
      setResultVisibility('hidden');
      setStartDate('');
      setStartClock('');
      setEndDate('');
      setEndClock('');
      setActiveTab('general');
      return;
    }

    // Saving settings or status replaces the exam object; re-hydrating then
    // would silently throw away unsaved edits in other fields.
    if (loadedExamIdRef.current === examId) return;
    setSectionDirty({ questions: false, settings: false, assignment: false });
    setVisitedTabs([initialTab ?? 'general']);
    setSaveError(null);
    setSavedAt(null);

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
      setPassingScore(50);
      setStatus('draft');
      setResultVisibility('hidden');
      setStartDate('');
      setStartClock('');
      setEndDate('');
      setEndClock('');
      setActiveTab('general');
    } else {
      if (!exam) return;
      {
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
    loadedExamIdRef.current = examId;
  }, [examId, exam, initialTab]);

  const creatingNewExam = examId?.startsWith('new-') ?? false;
  const generalSnapshot = JSON.stringify({
    title,
    description,
    subjectId,
    duration,
    examCode: requireExamCode ? examCode.trim() : null,
    maxAttempt: Number(maxAttempt),
    passingScore: Number(passingScore),
    startTime: startDate && startClock ? `${startDate}T${startClock}` : '',
    endTime: endDate && endClock ? `${endDate}T${endClock}` : '',
  });
  const savedGeneralSnapshot = exam ? JSON.stringify({
    title: exam.title,
    description: exam.description || '',
    subjectId: exam.subjectId || '',
    duration: exam.duration || 60,
    examCode: exam.examCode,
    maxAttempt: Number(exam.maxAttempt),
    passingScore: Number(exam.passingScore),
    startTime: scheduleKey(exam.startTime),
    endTime: scheduleKey(exam.endTime),
  }) : null;
  const generalDirty = creatingNewExam || savedGeneralSnapshot === null
    ? true
    : generalSnapshot !== savedGeneralSnapshot;

  const dirtySectionLabels = examId === null ? [] : [
    generalDirty && !creatingNewExam ? 'General Info' : null,
    sectionDirty.questions ? 'Questions' : null,
    sectionDirty.settings ? 'Settings' : null,
    sectionDirty.assignment ? 'Assignment' : null,
  ].filter((label): label is string => label !== null);
  const anyDirty = dirtySectionLabels.length > 0;

  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

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
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
      setSaveError('Passing score must be between 0 and 100.');
      return;
    }
    if (isNewExam && subjects.length === 0) {
      setSaveError('You have not been assigned to any subjects.');
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
        expectedVersion: isNewExam ? undefined : exam?.version,
      });
      setSavedAt(Date.now());
    } catch (error) {
      // The form keeps its edits so the teacher can correct and retry.
      const message = error instanceof Error ? error.message : 'Unable to save the exam.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const revertGeneral = () => {
    if (!exam) return;
    setTitle(exam.title);
    setDescription(exam.description || '');
    setSubject(exam.subject || '');
    setSubjectId(exam.subjectId || '');
    setDuration(exam.duration || 60);
    setExamCode(exam.examCode ?? '');
    setRequireExamCode(exam.examCode !== null);
    setMaxAttempt(exam.maxAttempt);
    setPassingScore(exam.passingScore);
    const [savedStartDate = '', savedStartTime = ''] = exam.startTime.split('T');
    const [savedEndDate = '', savedEndTime = ''] = exam.endTime.split('T');
    setStartDate(savedStartDate);
    setStartClock(savedStartTime.slice(0, 5));
    setEndDate(savedEndDate);
    setEndClock(savedEndTime.slice(0, 5));
    setSaveError(null);
  };

  // Check if has unsaved changes
  const scoresAreValid = Number.isFinite(passingScore)
    && passingScore >= 0
    && passingScore <= 100;
  const scheduleIsValid = Boolean(startDate && startClock && endDate && endClock)
    && `${endDate}T${endClock}` > `${startDate}T${startClock}`;
  const hasRequiredData = title.trim() !== ''
    && subjectId !== ''
    && (!isNewExam || subjects.length > 0)
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
      <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50/80 to-white px-6 py-5 space-y-4">
        {/* Title & Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm space-y-1">
              <div className="space-y-0.5">
                <Label htmlFor="exam-title" className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Exam Title
                </Label>
                <Input
                  id="exam-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled exam"
                  className="h-auto w-full min-w-0 border-0 bg-transparent px-0 text-lg font-bold text-black shadow-none placeholder:font-normal placeholder:text-gray-400 focus-visible:ring-0"
                />
              </div>
              <div className="space-y-0.5 border-t border-gray-100 pt-1">
                <Label htmlFor="exam-description" className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Description
                </Label>
                <Textarea
                  id="exam-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description or instructions for students..."
                  className="min-h-0 w-full min-w-0 resize-none border-0 bg-transparent px-0 py-0 text-xs font-medium text-gray-800 shadow-none placeholder:font-normal placeholder:text-gray-400 focus-visible:ring-0"
                  rows={1}
                />
              </div>
            </div>

            {/* Exam Info Bar - Only show for existing exams with data */}
            {!isNewExam && (subject || duration || (requireExamCode && examCode)) && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-gray-600">
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

          <div className="flex flex-col items-stretch gap-2 flex-shrink-0">
            <Select value={status} disabled={statusSaving} onValueChange={(value) => {
              if (value !== 'draft' && value !== 'published') return;
              if (value === 'published' && dirtySectionLabels.length > 0) {
                const message = `Save your changes before publishing: ${dirtySectionLabels.join(', ')}.`;
                setSaveError(message);
                toast.error(message);
                return;
              }
              void handleStatusSelect(value);
            }}>
              <SelectTrigger className={`w-36 rounded-full font-medium ${statusConfig[status].color}`} aria-label="Exam status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>

            {anyDirty && (
              <p className="w-36 text-right text-xs text-amber-600">
                Unsaved: {dirtySectionLabels.join(', ')}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => {
        if (isExamEditorTab(value)) setActiveTab(value);
      }} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start gap-1 border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="general"
            className="gap-1.5 rounded-none border-b-2 border-transparent px-4 text-gray-500 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:text-teal-700"
          >
            <FileText className="size-4" />
            General Info
            {generalDirty && !isNewExam && <span className="text-amber-500" title="Unsaved changes">&bull;</span>}
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="gap-1.5 rounded-none border-b-2 border-transparent px-4 text-gray-500 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:text-teal-700"
          >
            <BookOpen className="size-4" />
            Questions
            {sectionDirty.questions && <span className="text-amber-500" title="Unsaved changes">&bull;</span>}
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="gap-1.5 rounded-none border-b-2 border-transparent px-4 text-gray-500 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:text-teal-700"
          >
            <Settings2 className="size-4" />
            Settings
            {sectionDirty.settings && <span className="text-amber-500" title="Unsaved changes">&bull;</span>}
          </TabsTrigger>
          <TabsTrigger
            value="assignment"
            className="gap-1.5 rounded-none border-b-2 border-transparent px-4 text-gray-500 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:text-teal-700"
          >
            <Users className="size-4" />
            Assignment
            {sectionDirty.assignment && <span className="text-amber-500" title="Unsaved changes">&bull;</span>}
          </TabsTrigger>
        </TabsList>

        <div className={`flex-1 min-h-0 ${activeTab === 'questions' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <TabsContent value="general" forceMount className="m-0 p-6 data-[state=inactive]:hidden">
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
              saveError={null}
              onCancel={onClose}
              isNewExam={isNewExam}
              showActions={false}
            />
            <div className="mx-auto mt-6 max-w-4xl">
              <SectionSaveBar
                label={isNewExam ? 'Create Exam' : 'Save Changes'}
                dirty={generalDirty}
                saving={isSaving}
                savedAt={savedAt}
                error={saveError}
                saveDisabled={!hasRequiredData}
                onSave={() => void handleSave()}
                onDiscard={isNewExam ? undefined : revertGeneral}
              />
            </div>
          </TabsContent>

          {visitedTabs.includes('questions') && (
            <TabsContent value="questions" forceMount className="m-0 h-full p-0 data-[state=inactive]:hidden">
              <QuestionsTab
                examId={examId}
                subjectId={subjectId}
                expectedVersion={exam?.version}
                canCreateContent={subjects.some((item) => item.subject_id === subjectId)}
                onSaved={onSaved}
                onViewInQuestionBank={onViewInQuestionBank}
                onDirtyChange={handleQuestionsDirty}
              />
            </TabsContent>
          )}

          {visitedTabs.includes('settings') && (
            <TabsContent value="settings" forceMount className="m-0 p-6 data-[state=inactive]:hidden">
              <SettingsTab
                examId={examId}
                resultVisibility={resultVisibility}
                expectedVersion={exam?.version}
                onResultVisibilityChange={async (nextVisibility) => {
                  setResultVisibility(nextVisibility);
                }}
                onSaved={onSaved}
                onDirtyChange={handleSettingsDirty}
              />
            </TabsContent>
          )}

          {visitedTabs.includes('assignment') && (
            <TabsContent value="assignment" forceMount className="m-0 p-6 data-[state=inactive]:hidden">
              <AssignmentTab examId={examId} expectedVersion={exam?.version} onSaved={onSaved} onDirtyChange={handleAssignmentDirty} />
            </TabsContent>
          )}

        </div>
      </Tabs>

    </div>
  );
}
