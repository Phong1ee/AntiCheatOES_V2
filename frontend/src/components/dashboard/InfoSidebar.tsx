import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Bell, Camera, Mic, Award, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ExamCodesWidget } from './ExamCodesWidget';

export function InfoSidebar() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Exams Taken</p>
                <p className="text-xl text-gray-800">24</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Score</p>
                <p className="text-xl text-gray-800">85.5%</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Overall Progress</span>
              <span className="text-teal-600">86%</span>
            </div>
            <Progress value={86} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Exam Countdown */}
      <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-teal-500 to-blue-600 text-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="size-5" />
            Next Exam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm opacity-90">Database Systems Midterm</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl">02</p>
              <p className="text-xs opacity-75">Days</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl">14</p>
              <p className="text-xs opacity-75">Hours</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl">32</p>
              <p className="text-xs opacity-75">Mins</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Notifications */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <Bell className="size-5 text-teal-600" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-600 hover:bg-blue-600 mt-0.5">New</Badge>
              <div className="flex-1">
                <p className="text-sm text-gray-800">Web Development exam schedule updated</p>
                <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="border-yellow-600 text-yellow-700 mt-0.5">Reminder</Badge>
              <div className="flex-1">
                <p className="text-sm text-gray-800">Data Structures exam in 3 days</p>
                <p className="text-xs text-gray-500 mt-1">1 day ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Exam Checklist */}
      <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Pre-Exam Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <Camera className="size-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm text-gray-800">Check your camera</p>
              <p className="text-xs text-gray-500">Ensure it's working properly</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <Mic className="size-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm text-gray-800">Test your microphone</p>
              <p className="text-xs text-gray-500">Required for proctoring</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Exam History */}
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Recent Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-800">Operating Systems Quiz</p>
              <p className="text-xs text-gray-500">Nov 10, 2025</p>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">92%</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-800">Computer Networks Final</p>
              <p className="text-xs text-gray-500">Nov 5, 2025</p>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">88%</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-800">Algorithms Midterm</p>
              <p className="text-xs text-gray-500">Nov 1, 2025</p>
            </div>
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">78%</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Exam Codes Widget */}
      <ExamCodesWidget />
    </div>
  );
}