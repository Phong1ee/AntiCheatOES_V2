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
import { AlertCircle, Calendar, Clock, Hash, Save } from 'lucide-react';
import type { TeacherSubject } from '../../../../types/teacher-exam';

interface GeneralInfoTabProps {
  subject: string;
  subjectId: string;
  subjects: TeacherSubject[];
  examCode: string;
  duration: number;
  maxAttempt: number;
  totalPoints: number;
  passingScore: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  onSubjectChange: (value: string) => void;
  onExamCodeChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onMaxAttemptChange: (value: number) => void;
  onTotalPointsChange: (value: number) => void;
  onPassingScoreChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  canSave: boolean;
  isSaving: boolean;
  isNewExam: boolean;
  saveError: string | null;
  onCancel: () => void;
  onSave: () => void;
}

export function GeneralInfoTab({
  subject,
  subjectId,
  subjects,
  examCode,
  duration,
  maxAttempt,
  totalPoints,
  passingScore,
  startDate,
  startTime,
  endDate,
  endTime,
  onSubjectChange,
  onExamCodeChange,
  onDurationChange,
  onMaxAttemptChange,
  onTotalPointsChange,
  onPassingScoreChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  canSave,
  isSaving,
  isNewExam,
  saveError,
  onCancel,
  onSave,
}: GeneralInfoTabProps) {
  const subjectSelectValue = subjectId;

  // Validation
  const errors: string[] = [];
  if (!subject) errors.push('Subject is required');
  if (!Number.isInteger(totalPoints) || totalPoints <= 0) errors.push('Total points must be a positive integer');
  if (!Number.isInteger(passingScore) || passingScore < 0) errors.push('Passing score must be a non-negative integer');
  if (passingScore > totalPoints) errors.push('Passing score cannot exceed total points');
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
          <CardTitle className="text-gray-800">Basic Information</CardTitle>
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

          <div className="space-y-2">
            <Label htmlFor="examCode">Exam Code</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                id="examCode"
                value={examCode}
                onChange={(e) => onExamCodeChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              This code will be used by students to access the exam
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule & Duration */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-gray-800">Schedule & Duration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className={
                    startDate && startTime && endDate && endTime && `${endDate}T${endTime}` <= `${startDate}T${startTime}`
                      ? 'pl-10 border-red-300'
                      : 'pl-10'
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  className="pl-10"
                />
              </div>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="unlimited-attempts">Allow unlimited attempts</Label>
                {/* <p className="text-sm text-gray-500">
                  Students can retake this exam without a limit
                </p> */}
              </div>
              <Switch
                id="unlimited-attempts"
                checked={maxAttempt === 0}
                onCheckedChange={(checked) => onMaxAttemptChange(checked ? 0 : 1)}
              />
            </div>

            {maxAttempt !== 0 && (
              <div className="space-y-2">
                {/* <Label htmlFor="attempts">Number of Attempts</Label> */}
                <Input
                  id="attempts"
                  type="number"
                  value={maxAttempt}
                  onChange={(e) => onMaxAttemptChange(Math.max(1, Number(e.target.value) || 1))}
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="Enter number of attempts"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grading */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-gray-800">Grading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalPoints">Total Points</Label>
              <Input
                id="totalPoints"
                type="number"
                value={totalPoints}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onTotalPointsChange(Number.isFinite(value) ? value : 0);
                }}
                min="1"
                step="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passingScore">Passing Score</Label>
              <Input
                id="passingScore"
                type="number"
                value={passingScore}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onPassingScoreChange(Number.isFinite(value) ? value : 0);
                }}
                min="0"
                max={totalPoints}
                step="1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="mr-2 size-4" />
          {isSaving ? 'Saving...' : isNewExam ? 'Create Exam' : 'Save Changes'}
        </Button>
      </div>

    </div>
  );
}
