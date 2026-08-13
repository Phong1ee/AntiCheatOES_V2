import { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';

import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { GeneralInfoTab } from './tabs/GeneralInfoTab';
import type { TeacherSubject } from '../../../types/teacher-exam';

export interface CreateExamDraft {
  title: string;
  description: string;
  subjectId: string;
  duration: number;
  examCode: string | null;
  maxAttempt: number;
  passingScore: number;
  startTime: string;
  endTime: string;
}

interface CreateExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: TeacherSubject[];
  onCreate: (draft: CreateExamDraft) => Promise<void>;
}

const generateExamCode = () => `EXAM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

export function CreateExamDialog({ open, onOpenChange, subjects, onCreate }: CreateExamDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [duration, setDuration] = useState(60);
  const [examCode, setExamCode] = useState('');
  const [requireExamCode, setRequireExamCode] = useState(true);
  const [maxAttempt, setMaxAttempt] = useState(1);
  const [passingScore, setPassingScore] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Start from a clean draft every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setSubject('');
    setSubjectId('');
    setDuration(60);
    setExamCode(generateExamCode());
    setRequireExamCode(true);
    setMaxAttempt(1);
    setPassingScore(50);
    setStartDate('');
    setStartClock('');
    setEndDate('');
    setEndClock('');
    setSaveError(null);
    setIsSaving(false);
  }, [open]);

  const startTime = startDate && startClock ? `${startDate}T${startClock}:00` : '';
  const endTime = endDate && endClock ? `${endDate}T${endClock}:00` : '';
  const scoreIsValid = Number.isFinite(passingScore) && passingScore >= 0 && passingScore <= 100;
  const scheduleIsValid = Boolean(startTime && endTime) && endTime > startTime;
  const canCreate = title.trim() !== ''
    && subjectId !== ''
    && subjects.length > 0
    && (!requireExamCode || examCode.trim() !== '')
    && scoreIsValid
    && scheduleIsValid;

  const handleCreate = async () => {
    if (subjects.length === 0) {
      setSaveError('You have not been assigned to any subjects.');
      return;
    }
    if (!title.trim()) {
      setSaveError('Exam title is required.');
      return;
    }
    if (!scheduleIsValid) {
      setSaveError('Start and end date/time are required, and the end must be later than the start.');
      return;
    }
    if (!scoreIsValid) {
      setSaveError('Passing score must be between 0 and 100.');
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
      await onCreate({
        title,
        description,
        subjectId,
        duration,
        examCode: requireExamCode ? normalizedExamCode : null,
        maxAttempt,
        passingScore,
        startTime,
        endTime,
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to create the exam.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-gray-200 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <FileText className="size-4" />
            </span>
            Create New Exam
          </DialogTitle>
          <DialogDescription>
            Fill in the exam details. You can add questions, settings, and students after it is created.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-11rem)] overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-exam-title">Exam Title *</Label>
              <Input
                id="new-exam-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Midterm Exam"
                className={!title.trim() ? 'border-red-300' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-exam-description">Description</Label>
              <Textarea
                id="new-exam-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add a description or instructions for students..."
                rows={2}
              />
            </div>
          </div>

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
            saveError={saveError}
            onCancel={() => onOpenChange(false)}
            isNewExam
            showActions={false}
          />
        </div>

        <DialogFooter className="border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!canCreate || isSaving}
            className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="mr-2 size-4" />
            {isSaving ? 'Creating...' : 'Create Exam'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
