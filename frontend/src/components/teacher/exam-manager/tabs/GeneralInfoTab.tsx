import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Switch } from '../../../ui/switch';
import { AlertCircle, Award, Clock, Hash, Info, ListOrdered } from 'lucide-react';
import type { TeacherSubject } from '../../../../types/teacher-exam';

interface GeneralInfoTabProps {
  subject: string;
  subjectId: string;
  subjects: TeacherSubject[];
  examCode: string;
  requireExamCode: boolean;
  duration: number;
  maxAttempt: number;
  passingScore: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  onSubjectChange: (value: string) => void;
  onExamCodeChange: (value: string) => void;
  onRequireExamCodeChange: (value: boolean) => void;
  onDurationChange: (value: number) => void;
  onMaxAttemptChange: (value: number) => void;
  onPassingScoreChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  saveError: string | null;
  onCancel: () => void;
}

export function GeneralInfoTab({
  subject,
  subjectId,
  subjects,
  examCode,
  requireExamCode,
  duration,
  maxAttempt,
  passingScore,
  startDate,
  startTime,
  endDate,
  endTime,
  onSubjectChange,
  onExamCodeChange,
  onRequireExamCodeChange,
  onDurationChange,
  onMaxAttemptChange,
  onPassingScoreChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  saveError,
  onCancel,
}: GeneralInfoTabProps) {
  const subjectSelectValue = subjectId;

  // Validation
  const errors: string[] = [];
  if (!subject) errors.push('Subject is required');
  if (requireExamCode && !examCode.trim()) errors.push('Exam code is required when code protection is enabled');
  if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
    errors.push('Passing score must be between 0 and 100');
  }
  if (!startDate || !startTime) errors.push('Start date and time are required');
  if (!endDate || !endTime) errors.push('End date and time are required');
  if (startDate && startTime && endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) {
    errors.push('End date and time must be later than start date and time');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <AlertCircle className="size-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-800 mb-2">Please fix the following errors:</p>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Info className="size-4" />
            </span>
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xl space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select value={subjectSelectValue} onValueChange={onSubjectChange}>
                <SelectTrigger id="subject" className={!subject ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((item) => (
                    <SelectItem key={item.subject_id} value={item.subject_id}>{item.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="require-exam-code">Require exam code</Label>
                <p className="text-xs text-gray-500">Students must enter the code before starting this exam.</p>
              </div>
              <Switch
                id="require-exam-code"
                checked={requireExamCode}
                onCheckedChange={onRequireExamCodeChange}
              />
            </div>
            {requireExamCode && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="examCode">Exam Code *</Label>
                <div className="relative max-w-xs">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="examCode"
                    value={examCode}
                    onChange={(e) => onExamCodeChange(e.target.value)}
                    className={`pl-10 font-mono ${!examCode.trim() ? 'border-red-300' : ''}`}
                    maxLength={20}
                  />
                </div>
                {!examCode.trim() && <p className="text-xs text-red-600">Enter an exam code before saving.</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule & Duration */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="size-4" />
            </span>
            Schedule & Duration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className={
                  startDate && startTime && endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`
                    ? 'border-red-300'
                    : ''
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Time Limit (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={duration.toString()}
              onChange={(e) => onDurationChange(parseInt(e.target.value) || 0)}
              min="1"
              max="300"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="unlimited-attempts">Allow unlimited attempts</Label>
                <p className="text-xs text-gray-500">
                  Students can retake this exam as many times as they like.
                </p>
              </div>
              <Switch
                id="unlimited-attempts"
                checked={maxAttempt === 0}
                onCheckedChange={(checked) => onMaxAttemptChange(checked ? 0 : 1)}
              />
            </div>

            {maxAttempt !== 0 && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="attempts">Number of Attempts</Label>
                <div className="relative max-w-[160px]">
                  <ListOrdered className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    id="attempts"
                    type="number"
                    value={maxAttempt}
                    onChange={(e) => onMaxAttemptChange(Math.max(1, Number(e.target.value) || 1))}
                    min="1"
                    step="1"
                    inputMode="numeric"
                    placeholder="1"
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grading */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Award className="size-4" />
            </span>
            Grading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passingScore">Passing Score</Label>
            <div className="flex max-w-[200px] items-center gap-2">
              <Input
                id="passingScore"
                type="number"
                value={passingScore}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onPassingScoreChange(Number.isFinite(value) ? value : 0);
                }}
                min="0"
                max="100"
                step="0.01"
              />
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">/ 100</span>
            </div>
            <p className="text-xs text-gray-500">
              {Number.isFinite(passingScore)
                ? `Students need a score of ${passingScore} or higher (out of 100) to pass.`
                : 'Enter a passing threshold from 0.00 to 100.00.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

    </div>
  );
}
