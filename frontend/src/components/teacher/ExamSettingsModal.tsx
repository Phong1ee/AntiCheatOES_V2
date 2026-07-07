import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  X,
  Settings,
  Calendar,
  Clock,
  Shield,
  Users,
  FileText,
  Save,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  totalStudents: number;
  completedStudents: number;
  averageScore: number | null;
  status: 'upcoming' | 'ongoing' | 'completed';
}

interface ExamSettingsModalProps {
  exam: Exam;
  onClose: () => void;
}

export function ExamSettingsModal({ exam, onClose }: ExamSettingsModalProps) {
  // General Settings
  const [title, setTitle] = useState(exam.title);
  const [subject, setSubject] = useState(exam.subject);
  const [date, setDate] = useState(exam.date);
  const [time, setTime] = useState(exam.time);
  const [duration, setDuration] = useState(exam.duration.toString());
  const [passingScore, setPassingScore] = useState('60');

  // Security Settings
  const [webcamMonitoring, setWebcamMonitoring] = useState(true);
  const [screenRecording, setScreenRecording] = useState(true);
  const [tabSwitchDetection, setTabSwitchDetection] = useState(true);
  const [copyPasteBlocking, setCopyPasteBlocking] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeAnswers, setRandomizeAnswers] = useState(false);

  // Access Settings
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [allowReview, setAllowReview] = useState(true);

  const handleSave = () => {
    // In a real app, this would save to backend
    console.log('Saving exam settings...');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        {/* Header with Gradient */}
        <div className="relative bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white rounded-t-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </Button>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Settings className="size-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl mb-2">Exam Settings</h2>
              <p className="text-white/90">{exam.title}</p>
              <p className="text-white/80 text-sm">{exam.subject}</p>
            </div>
          </div>
        </div>

        {/* Content with Tabs */}
        <div className="p-6">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">
                <FileText className="size-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="size-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="access">
                <Users className="size-4 mr-2" />
                Access & Grading
              </TabsTrigger>
            </TabsList>

            {/* General Settings Tab */}
            <TabsContent value="general" className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Note</p>
                  <p>
                    Changes to exam settings will only affect future sessions. Ongoing or
                    completed exams cannot be modified.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter exam title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Exam Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Start Time</Label>
                  <Input
                    id="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g., 09:00 AM"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="90"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passing">Passing Score (%)</Label>
                  <Input
                    id="passing"
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    placeholder="60"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Enter exam description and instructions..."
                  defaultValue="Comprehensive assessment covering all topics from weeks 1-7 of the course."
                />
              </div>
            </TabsContent>

            {/* Security Settings Tab */}
            <TabsContent value="security" className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Shield className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Enhanced Security</p>
                  <p>
                    Enable proctoring features to maintain exam integrity and prevent cheating.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-gray-800">Proctoring Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border border-teal-200">
                    <div className="flex-1">
                      <Label htmlFor="webcam" className="text-base cursor-pointer">
                        Webcam Monitoring
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Require students to enable webcam during the exam
                      </p>
                    </div>
                    <Switch
                      id="webcam"
                      checked={webcamMonitoring}
                      onCheckedChange={setWebcamMonitoring}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                    <div className="flex-1">
                      <Label htmlFor="screen" className="text-base cursor-pointer">
                        Screen Recording
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Record student screen activity during the exam
                      </p>
                    </div>
                    <Switch
                      id="screen"
                      checked={screenRecording}
                      onCheckedChange={setScreenRecording}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                    <div className="flex-1">
                      <Label htmlFor="tab" className="text-base cursor-pointer">
                        Tab Switch Detection
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Alert when students switch to another browser tab
                      </p>
                    </div>
                    <Switch
                      id="tab"
                      checked={tabSwitchDetection}
                      onCheckedChange={setTabSwitchDetection}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                    <div className="flex-1">
                      <Label htmlFor="copy" className="text-base cursor-pointer">
                        Copy/Paste Blocking
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Disable copy and paste functionality during exam
                      </p>
                    </div>
                    <Switch
                      id="copy"
                      checked={copyPasteBlocking}
                      onCheckedChange={setCopyPasteBlocking}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-gray-800">Question Randomization</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex-1">
                      <Label htmlFor="randomQ" className="text-base cursor-pointer">
                        Randomize Question Order
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Show questions in different order for each student
                      </p>
                    </div>
                    <Switch
                      id="randomQ"
                      checked={randomizeQuestions}
                      onCheckedChange={setRandomizeQuestions}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex-1">
                      <Label htmlFor="randomA" className="text-base cursor-pointer">
                        Randomize Answer Options
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Shuffle answer choices for multiple choice questions
                      </p>
                    </div>
                    <Switch
                      id="randomA"
                      checked={randomizeAnswers}
                      onCheckedChange={setRandomizeAnswers}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Access & Grading Tab */}
            <TabsContent value="access" className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <Users className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">Access Control</p>
                  <p>Manage how students can access and view their exam results.</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-gray-800">Submission Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex-1">
                      <Label htmlFor="late" className="text-base cursor-pointer">
                        Allow Late Submission
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Students can submit after the deadline with penalty
                      </p>
                    </div>
                    <Switch
                      id="late"
                      checked={allowLateSubmission}
                      onCheckedChange={setAllowLateSubmission}
                    />
                  </div>

                  {allowLateSubmission && (
                    <div className="ml-4 p-4 bg-white rounded-lg border border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="lateDays">Grace Period (days)</Label>
                          <Input
                            id="lateDays"
                            type="number"
                            placeholder="2"
                            defaultValue="2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="penalty">Penalty per day (%)</Label>
                          <Input
                            id="penalty"
                            type="number"
                            placeholder="10"
                            defaultValue="10"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-gray-800">Result Visibility</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex-1">
                      <Label htmlFor="results" className="text-base cursor-pointer">
                        Show Results to Students
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Students can view their scores after submission
                      </p>
                    </div>
                    <Switch
                      id="results"
                      checked={showResults}
                      onCheckedChange={setShowResults}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex-1">
                      <Label htmlFor="review" className="text-base cursor-pointer">
                        Allow Answer Review
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Students can review their answers and correct answers
                      </p>
                    </div>
                    <Switch
                      id="review"
                      checked={allowReview}
                      onCheckedChange={setAllowReview}
                    />
                  </div>

                  {showResults && (
                    <div className="ml-4 p-4 bg-white rounded-lg border border-gray-200">
                      <div className="space-y-2">
                        <Label htmlFor="resultTime">Release Results</Label>
                        <Select defaultValue="immediate">
                          <SelectTrigger id="resultTime">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Immediately after submission</SelectItem>
                            <SelectItem value="allComplete">After all students complete</SelectItem>
                            <SelectItem value="manual">Manual release by teacher</SelectItem>
                            <SelectItem value="scheduled">On scheduled date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg text-gray-800">Grading Method</h3>
                
                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200">
                  <div className="space-y-2">
                    <Label htmlFor="grading">Grading Scale</Label>
                    <Select defaultValue="percentage">
                      <SelectTrigger id="grading">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
                        <SelectItem value="points">Points Based</SelectItem>
                        <SelectItem value="letter">Letter Grade (A-F)</SelectItem>
                        <SelectItem value="passfail">Pass/Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="px-6">
            <ArrowLeft className="size-4 mr-2" />
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="hover:bg-blue-50 hover:border-blue-300 border-blue-200"
            >
              Reset to Default
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg px-6"
            >
              <Save className="size-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
