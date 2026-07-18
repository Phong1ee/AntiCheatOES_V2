import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/card';
import { Label } from '../../../ui/label';
import { Switch } from '../../../ui/switch';
import { Input } from '../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Shuffle, Clock, Maximize, Shield, Camera, Lock, CheckCircle, Eye } from 'lucide-react';

export function SettingsTab() {
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [gracePeriod, setGracePeriod] = useState('5');
  const [fullscreen, setFullscreen] = useState(true);
  const [tabSwitchAction, setTabSwitchAction] = useState('warn');
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(false);
  const [disableCopyPaste, setDisableCopyPaste] = useState(true);
  const [webcamMonitoring, setWebcamMonitoring] = useState(true);
  const [lockdownBrowser, setLockdownBrowser] = useState(false);
  const [autoGradeMcq, setAutoGradeMcq] = useState(true);
  const [manualGradeEssay, setManualGradeEssay] = useState(true);
  const [publishGrades, setPublishGrades] = useState(false);
  const [showResultsToStudents, setShowResultsToStudents] = useState(true);
  const [allowAnswerReview, setAllowAnswerReview] = useState(true);
  const [releaseResults, setReleaseResults] = useState('immediately');
  
  // Individual violation thresholds
  const [tabSwitchThreshold, setTabSwitchThreshold] = useState('3');
  const [copyPasteThreshold, setCopyPasteThreshold] = useState('5');
  const [fullscreenExitThreshold, setFullscreenExitThreshold] = useState('3');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Randomization */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Shuffle className="size-5 text-teal-600" />
            Randomization
          </CardTitle>
          <CardDescription>Shuffle questions and answers to reduce cheating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
              <p className="text-sm text-gray-500">Randomize question order for each student</p>
            </div>
            <Switch
              id="shuffle-questions"
              checked={shuffleQuestions}
              onCheckedChange={setShuffleQuestions}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="shuffle-answers">Shuffle Answer Options</Label>
              <p className="text-sm text-gray-500">Randomize answer choices in MCQ questions</p>
            </div>
            <Switch
              id="shuffle-answers"
              checked={shuffleAnswers}
              onCheckedChange={setShuffleAnswers}
            />
          </div>
        </CardContent>
      </Card>

      {/* Time Settings */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Clock className="size-5 text-teal-600" />
            Time Settings
          </CardTitle>
          <CardDescription>Configure time limits and submission behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-submit">Auto-submit on Time Expiry</Label>
              <p className="text-sm text-gray-500">
                Automatically submit exam when time runs out
              </p>
            </div>
            <Switch id="auto-submit" checked={autoSubmit} onCheckedChange={setAutoSubmit} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grace-period">Grace Period (minutes)</Label>
            <Input
              id="grace-period"
              type="number"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(e.target.value)}
              min="0"
              max="30"
              className="max-w-xs"
            />
            <p className="text-sm text-gray-500">
              Extra time allowed after deadline for submission
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Maximize className="size-5 text-teal-600" />
            Display Settings
          </CardTitle>
          <CardDescription>Control how the exam is displayed to students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fullscreen">Force Fullscreen Mode</Label>
              <p className="text-sm text-gray-500">
                Require students to take exam in fullscreen
              </p>
            </div>
            <Switch id="fullscreen" checked={fullscreen} onCheckedChange={setFullscreen} />
          </div>
        </CardContent>
      </Card>

      {/* Anti-Cheating */}
      <Card className="shadow-md rounded-2xl border-0 border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Shield className="size-5 text-red-600" />
            Anti-Cheating Measures
          </CardTitle>
          <CardDescription>Enable security features to prevent cheating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-anti-cheat">Enable Anti-Cheat</Label>
              {/* <p className="text-sm text-gray-500">
                Turn on anti-cheat monitoring and security settings
              </p> */}
            </div>
            <Switch
              id="enable-anti-cheat"
              checked={antiCheatEnabled}
              onCheckedChange={setAntiCheatEnabled}
            />
          </div>

          {antiCheatEnabled && (
            <>
          <div className="space-y-2">
            <Label htmlFor="tab-switch">Tab Switch Detection</Label>
            <Select value={tabSwitchAction} onValueChange={setTabSwitchAction}>
              <SelectTrigger id="tab-switch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No action</SelectItem>
                <SelectItem value="warn">Show warning</SelectItem>
                <SelectItem value="flag">Flag for review</SelectItem>
                <SelectItem value="submit">Auto-submit exam</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              Action to take when student switches browser tabs
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="copy-paste">Disable Copy/Paste</Label>
              <p className="text-sm text-gray-500">
                Prevent students from copying and pasting content
              </p>
            </div>
            <Switch
              id="copy-paste"
              checked={disableCopyPaste}
              onCheckedChange={setDisableCopyPaste}
            />
          </div>

          {/* <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="webcam" className="flex items-center gap-2">
                <Camera className="size-4 text-teal-600" />
                Webcam Monitoring
              </Label>
              <p className="text-sm text-gray-500">
                Record student via webcam during exam
              </p>
            </div>
            <Switch
              id="webcam"
              checked={webcamMonitoring}
              onCheckedChange={setWebcamMonitoring}
            />
          </div> */}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="lockdown" className="flex items-center gap-2">
                <Lock className="size-4 text-teal-600" />
                Lockdown Browser Mode
              </Label>
              <p className="text-sm text-gray-500">
                Restrict browser features during exam (experimental)
              </p>
            </div>
            <Switch
              id="lockdown"
              checked={lockdownBrowser}
              onCheckedChange={setLockdownBrowser}
            />
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div>
              <Label className="text-base">Violation Thresholds</Label>
              <p className="text-sm text-gray-500 mt-1">
                Configure individual thresholds for each violation type
              </p>
            </div>

            <div className="space-y-3">
              {/* Tab Switch Threshold */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tab-switch-threshold" className="text-sm">
                    Tab Switch Violations
                  </Label>
                  <p className="text-xs text-gray-500">
                    Max switches before action is taken
                  </p>
                </div>
                <Input
                  id="tab-switch-threshold"
                  type="number"
                  value={tabSwitchThreshold}
                  onChange={(e) => setTabSwitchThreshold(e.target.value)}
                  min="1"
                  max="10"
                  className="w-20 text-center"
                />
              </div>

              {/* Copy/Paste Threshold */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="copy-paste-threshold" className="text-sm">
                    Copy/Paste Attempts
                  </Label>
                  <p className="text-xs text-gray-500">
                    Max attempts before flagging
                  </p>
                </div>
                <Input
                  id="copy-paste-threshold"
                  type="number"
                  value={copyPasteThreshold}
                  onChange={(e) => setCopyPasteThreshold(e.target.value)}
                  min="1"
                  max="10"
                  className="w-20 text-center"
                />
              </div>

              {/* Fullscreen Exit Threshold */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="fullscreen-threshold" className="text-sm">
                    Fullscreen Exit Violations
                  </Label>
                  <p className="text-xs text-gray-500">
                    Max exits before auto-submit
                  </p>
                </div>
                <Input
                  id="fullscreen-threshold"
                  type="number"
                  value={fullscreenExitThreshold}
                  onChange={(e) => setFullscreenExitThreshold(e.target.value)}
                  min="1"
                  max="10"
                  className="w-20 text-center"
                />
              </div>
            </div>
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Grading Settings */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <CheckCircle className="size-5 text-teal-600" />
            Grading Settings
          </CardTitle>
          {/* <CardDescription>Configure automatic and manual grading</CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-grade">Auto-grade MCQ Questions</Label>
              <p className="text-sm text-gray-500">
                Automatically grade multiple choice questions
              </p>
            </div>
            <Switch id="auto-grade" checked={autoGradeMcq} onCheckedChange={setAutoGradeMcq} />
          </div>

          {/* <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="publish-grades">Publish Grades</Label>
              <p className="text-sm text-gray-500">
                Allow students to view their exam results
              </p>
            </div>
            <Switch
              id="publish-grades"
              checked={publishGrades}
              onCheckedChange={setPublishGrades}
            />
          </div>
           */}

          {/* <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="manual-grade">Manual Grading for Essays</Label>
              <p className="text-sm text-gray-500">
                Require manual review for essay questions
              </p>
            </div>
            <Switch
              id="manual-grade"
              checked={manualGradeEssay}
              onCheckedChange={setManualGradeEssay}
            />
          </div> */}
        </CardContent>
      </Card>

      {/* Result Visibility */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Eye className="size-5 text-teal-600" />
            Result Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-results">Show Results to Students</Label>
              <p className="text-sm text-gray-500">
                Students can view their scores after submission
              </p>
            </div>
            <Switch
              id="show-results"
              checked={showResultsToStudents}
              onCheckedChange={setShowResultsToStudents}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="answer-review">Allow Answer Review</Label>
              <p className="text-sm text-gray-500">
                Students can review their answers and correct answers
              </p>
            </div>
            <Switch
              id="answer-review"
              checked={allowAnswerReview}
              onCheckedChange={setAllowAnswerReview}
            />
          </div>

          <div className="rounded-xl border border-gray-200 p-5 space-y-2">
            <Label htmlFor="release-results">Release Results</Label>
            <Select value={releaseResults} onValueChange={setReleaseResults}>
              <SelectTrigger id="release-results" className="bg-gray-100 border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediately">Immediately after submission</SelectItem>
                <SelectItem value="after-deadline">After the exam deadline</SelectItem>
                <SelectItem value="manual">Manually by teacher</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
