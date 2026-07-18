import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Slider } from './ui/slider';
import {
  Settings,
  Bell,
  Eye,
  Globe,
  Moon,
  Volume2,
  Palette,
  Save,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export function Preferences() {
  const [preferences, setPreferences] = useState({
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    examReminders: true,
    resultNotifications: true,
    reminderTime: 60, // minutes before exam

    // Display
    theme: 'light',
    language: 'en',
    fontSize: 'medium',
    colorScheme: 'teal',

    // Accessibility
    highContrast: false,
    reduceMotion: false,
    screenReader: false,

    // Exam
    autoSaveInterval: 30, // seconds
    showTimer: true,
    soundEffects: true,
    soundVolume: 50,
  });

  const handleToggle = (field: string) => {
    setPreferences({ ...preferences, [field]: !preferences[field] });
  };

  const handleSelect = (field: string, value: string) => {
    setPreferences({ ...preferences, [field]: value });
  };

  const handleSlider = (field: string, value: number[]) => {
    setPreferences({ ...preferences, [field]: value[0] });
  };

  const handleSave = () => {
    toast.success('Preferences saved successfully!');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-gray-800">Preferences</h1>
        <p className="text-gray-600 mt-1">Customize your OES experience</p>
      </div>

      {/* Notifications */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Bell className="size-5 text-teal-600" />
            Notifications
          </CardTitle>
          <CardDescription>Manage how you receive notifications and reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Email Notifications</Label>
              <p className="text-sm text-gray-500">Receive exam updates via email</p>
            </div>
            <Switch
              id="emailNotifications"
              checked={preferences.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pushNotifications">Push Notifications</Label>
              <p className="text-sm text-gray-500">Get instant browser notifications</p>
            </div>
            <Switch
              id="pushNotifications"
              checked={preferences.pushNotifications}
              onCheckedChange={() => handleToggle('pushNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="examReminders">Exam Reminders</Label>
              <p className="text-sm text-gray-500">Get reminded before exams start</p>
            </div>
            <Switch
              id="examReminders"
              checked={preferences.examReminders}
              onCheckedChange={() => handleToggle('examReminders')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="resultNotifications">Result Notifications</Label>
              <p className="text-sm text-gray-500">Get notified when results are published</p>
            </div>
            <Switch
              id="resultNotifications"
              checked={preferences.resultNotifications}
              onCheckedChange={() => handleToggle('resultNotifications')}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Reminder Time (minutes before exam)</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[preferences.reminderTime]}
                onValueChange={(value) => handleSlider('reminderTime', value)}
                min={5}
                max={120}
                step={5}
                className="flex-1"
              />
              <span className="text-sm text-gray-700 w-16 text-right">
                {preferences.reminderTime} min
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Monitor className="size-5 text-teal-600" />
            Display Settings
          </CardTitle>
          <CardDescription>Customize the appearance of the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme" className="flex items-center gap-2">
                <Moon className="size-4 text-teal-600" />
                Theme
              </Label>
              <Select value={preferences.theme} onValueChange={(value) => handleSelect('theme', value)}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto (System)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="flex items-center gap-2">
                <Globe className="size-4 text-teal-600" />
                Language
              </Label>
              <Select value={preferences.language} onValueChange={(value) => handleSelect('language', value)}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="vi">Vietnamese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontSize" className="flex items-center gap-2">
                <Eye className="size-4 text-teal-600" />
                Font Size
              </Label>
              <Select value={preferences.fontSize} onValueChange={(value) => handleSelect('fontSize', value)}>
                <SelectTrigger id="fontSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="extra-large">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="colorScheme" className="flex items-center gap-2">
                <Palette className="size-4 text-teal-600" />
                Color Scheme
              </Label>
              <Select value={preferences.colorScheme} onValueChange={(value) => handleSelect('colorScheme', value)}>
                <SelectTrigger id="colorScheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teal">Teal (Default)</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Settings className="size-5 text-teal-600" />
            Accessibility
          </CardTitle>
          <CardDescription>Options to improve accessibility and usability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="highContrast">High Contrast Mode</Label>
              <p className="text-sm text-gray-500">Increase contrast for better visibility</p>
            </div>
            <Switch
              id="highContrast"
              checked={preferences.highContrast}
              onCheckedChange={() => handleToggle('highContrast')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reduceMotion">Reduce Motion</Label>
              <p className="text-sm text-gray-500">Minimize animations and transitions</p>
            </div>
            <Switch
              id="reduceMotion"
              checked={preferences.reduceMotion}
              onCheckedChange={() => handleToggle('reduceMotion')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="screenReader">Screen Reader Optimization</Label>
              <p className="text-sm text-gray-500">Optimize interface for screen readers</p>
            </div>
            <Switch
              id="screenReader"
              checked={preferences.screenReader}
              onCheckedChange={() => handleToggle('screenReader')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exam Settings */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Settings className="size-5 text-teal-600" />
            Exam Settings
          </CardTitle>
          <CardDescription>Configure your exam-taking experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Auto-Save Interval (seconds)</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[preferences.autoSaveInterval]}
                onValueChange={(value) => handleSlider('autoSaveInterval', value)}
                min={10}
                max={120}
                step={10}
                className="flex-1"
              />
              <span className="text-sm text-gray-700 w-16 text-right">
                {preferences.autoSaveInterval}s
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showTimer">Show Timer During Exam</Label>
              <p className="text-sm text-gray-500">Display countdown timer while taking exams</p>
            </div>
            <Switch
              id="showTimer"
              checked={preferences.showTimer}
              onCheckedChange={() => handleToggle('showTimer')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="soundEffects">Sound Effects</Label>
              <p className="text-sm text-gray-500">Play sounds for exam events</p>
            </div>
            <Switch
              id="soundEffects"
              checked={preferences.soundEffects}
              onCheckedChange={() => handleToggle('soundEffects')}
            />
          </div>

          {preferences.soundEffects && (
            <div className="space-y-2 pt-2">
              <Label className="flex items-center gap-2">
                <Volume2 className="size-4 text-teal-600" />
                Sound Volume
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[preferences.soundVolume]}
                  onValueChange={(value) => handleSlider('soundVolume', value)}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm text-gray-700 w-16 text-right">
                  {preferences.soundVolume}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">Reset to Default</Button>
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
        >
          <Save className="size-4 mr-2" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
}