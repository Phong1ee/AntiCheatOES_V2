import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Switch } from '../../../ui/switch';
import { AlertCircle, Calendar, Clock, Hash, Upload } from 'lucide-react';
import type { TeacherSubject } from '../../../../types/teacher-exam';

interface GeneralInfoTabProps {
  subject: string;
  subjectId: string;
  subjects: TeacherSubject[];
  classGroup: string;
  examCode: string;
  duration: number;
  maxAttempt: number;
  onSubjectChange: (value: string) => void;
  onClassGroupChange: (value: string) => void;
  onExamCodeChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onMaxAttemptChange: (value: number) => void;
}

export function GeneralInfoTab({
  subject,
  subjectId,
  subjects,
  classGroup,
  examCode,
  duration,
  maxAttempt,
  onSubjectChange,
  onClassGroupChange,
  onExamCodeChange,
  onDurationChange,
  onMaxAttemptChange,
}: GeneralInfoTabProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalPoints, setTotalPoints] = useState('100');
  const [passingScore, setPassingScore] = useState('60');
  const [tags, setTags] = useState('');

  // Class mapping
  const classMap: Record<string, string> = {
    'CS301': 'cs301',
    'CS201': 'cs201',
    'CS102': 'cs102',
  };

  const reverseClassMap: Record<string, string> = {
    'cs301': 'CS301',
    'cs201': 'CS201',
    'cs102': 'CS102',
  };

  // Get select values
  const subjectSelectValue = subjectId;
  const classSelectValue = classMap[classGroup] || '';

  const handleClassChange = (value: string) => {
    onClassGroupChange(reverseClassMap[value] || value);
  };

  // Validation
  const errors: string[] = [];
  if (!subject) errors.push('Subject is required');
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    errors.push('End date must be after start date');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
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
              <Label htmlFor="class">Class/Group *</Label>
              <Select value={classSelectValue} onValueChange={handleClassChange}>
                <SelectTrigger id="class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs301">CS301 - Fall 2025</SelectItem>
                  <SelectItem value="cs201">CS201 - Fall 2025</SelectItem>
                  <SelectItem value="cs102">CS102 - Fall 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  onChange={(e) => setStartDate(e.target.value)}
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
                  onChange={(e) => setStartTime(e.target.value)}
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
                  onChange={(e) => setEndDate(e.target.value)}
                  className={
                    startDate && endDate && new Date(endDate) < new Date(startDate)
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
                  onChange={(e) => setEndTime(e.target.value)}
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
                onChange={(e) => setTotalPoints(e.target.value)}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passingScore">Passing Score</Label>
              <Input
                id="passingScore"
                type="number"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                min="0"
                max="100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags & Attachments */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-gray-800">Tags & Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas (e.g., midterm, chapter1-3)"
            />
            <p className="text-xs text-gray-500">
              Tags help organize and search for exams
            </p>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer">
              <Upload className="size-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500 mt-1">PDF, DOC, Images (Max 10MB)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
