import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/card';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Checkbox } from '../../../ui/checkbox';
import { Switch } from '../../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  Users,
  Link as LinkIcon,
  Lock,
  Copy,
  Send,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string;
  class: string;
}

const mockStudents: Student[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', class: 'CS301' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', class: 'CS301' },
  { id: '3', name: 'Carol Davis', email: 'carol@example.com', class: 'CS301' },
  { id: '4', name: 'David Wilson', email: 'david@example.com', class: 'CS301' },
  { id: '5', name: 'Emma Brown', email: 'emma@example.com', class: 'CS301' },
];

export function AssignmentTab() {
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [examLink, setExamLink] = useState('https://oes.edu/exam/EXAM-ABC123');
  const [enablePassword, setEnablePassword] = useState(false);
  const [examPassword, setExamPassword] = useState('');
  const [restrictIP, setRestrictIP] = useState(false);
  const [allowedIP, setAllowedIP] = useState('');

  const filteredStudents = mockStudents
    .filter((s) => selectedClass === 'all' || s.class === selectedClass)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.id));
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(examLink);
    toast.success('Exam link copied to clipboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Exam Link */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <LinkIcon className="size-5 text-teal-600" />
            Exam Link
          </CardTitle>
          <CardDescription>Share this link with students to access the exam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={examLink} readOnly className="flex-1" />
            <Button onClick={copyLink} variant="outline">
              <Copy className="size-4 mr-2" />
              Copy
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="size-4 text-teal-600" />
                  Require Password
                </Label>
                <p className="text-sm text-gray-500">Students must enter password to start exam</p>
              </div>
              <Switch
                id="password"
                checked={enablePassword}
                onCheckedChange={setEnablePassword}
              />
            </div>

            {enablePassword && (
              <Input
                value={examPassword}
                onChange={(e) => setExamPassword(e.target.value)}
                placeholder="Enter exam password"
                className="max-w-sm"
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="restrict-ip">Restrict by IP Address</Label>
                <p className="text-sm text-gray-500">
                  Only allow access from specific IP addresses
                </p>
              </div>
              <Switch id="restrict-ip" checked={restrictIP} onCheckedChange={setRestrictIP} />
            </div>

            {restrictIP && (
              <Input
                value={allowedIP}
                onChange={(e) => setAllowedIP(e.target.value)}
                placeholder="Enter IP addresses (comma-separated)"
                className="max-w-sm"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign to Students */}
      <Card className="shadow-md rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Users className="size-5 text-teal-600" />
            Assign to Students
          </CardTitle>
          <CardDescription>Select students who can access this exam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="CS301">CS301 - Fall 2025</SelectItem>
                <SelectItem value="CS201">CS201 - Fall 2025</SelectItem>
                <SelectItem value="CS102">CS102 - Fall 2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={
                  filteredStudents.length > 0 &&
                  selectedStudents.length === filteredStudents.length
                }
                onCheckedChange={selectAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer">
                Select All ({filteredStudents.length} students)
              </Label>
            </div>
            <span className="text-sm text-gray-600">{selectedStudents.length} selected</span>
          </div>

          {/* Student List */}
          <div className="border border-gray-200 rounded-xl max-h-[400px] overflow-y-auto">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`student-${student.id}`}
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {student.class}
                  </Badge>
                </div>
              </div>
            ))}

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p>No students found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send Notification */}
      <Card className="shadow-md rounded-2xl border-0 bg-gradient-to-r from-teal-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-gray-800 mb-1">Send Notification to Students</h4>
              <p className="text-sm text-gray-600">
                Notify {selectedStudents.length} selected students about this exam
              </p>
            </div>
            <Button
              disabled={selectedStudents.length === 0}
              className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            >
              <Send className="size-4 mr-2" />
              Send Notification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}