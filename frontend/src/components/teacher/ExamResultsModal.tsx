import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  X,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Award,
  Users,
  Target,
  Clock,
  Download,
  Search,
  Mail,
  Eye,
  BarChart3,
  PieChart,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

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

interface ExamResultsModalProps {
  exam: Exam;
  onClose: () => void;
}

interface StudentResult {
  id: string;
  name: string;
  email: string;
  score: number;
  grade: string;
  status: 'passed' | 'failed';
  submittedAt: string;
  timeTaken: number;
  violations: number;
  isLate: boolean;
}

// Mock student results data
const generateStudentResults = (examId: string, totalStudents: number, examDuration: number): StudentResult[] => {
  const students = [
    'Emma Johnson', 'Liam Smith', 'Olivia Williams', 'Noah Brown', 'Ava Davis',
    'Ethan Miller', 'Sophia Wilson', 'Mason Moore', 'Isabella Taylor', 'William Anderson',
    'Mia Thomas', 'James Jackson', 'Charlotte White', 'Benjamin Harris', 'Amelia Martin',
    'Lucas Thompson', 'Harper Garcia', 'Henry Martinez', 'Evelyn Robinson', 'Alexander Clark',
  ];

  return Array.from({ length: Math.min(totalStudents, students.length) }, (_, i) => {
    const score = Math.floor(Math.random() * 40) + 60; // 60-100
    
    // Most students finish within exam duration, some use extra time, few are very late
    const random = Math.random();
    let timeTaken: number;
    let isLate: boolean;
    
    if (random < 0.05) {
      // 5% - Very late (significantly over time)
      timeTaken = examDuration + Math.floor(Math.random() * (examDuration * 0.5)) + 10;
      isLate = true;
    } else if (random < 0.15) {
      // 10% - Slightly late (just over time limit)
      timeTaken = examDuration + Math.floor(Math.random() * 10) + 1;
      isLate = true;
    } else if (random < 0.35) {
      // 20% - Early finishers (60-80% of duration)
      timeTaken = Math.floor(examDuration * 0.6 + Math.random() * (examDuration * 0.2));
      isLate = false;
    } else {
      // 65% - Normal finishers (80-100% of duration)
      timeTaken = Math.floor(examDuration * 0.8 + Math.random() * (examDuration * 0.2));
      isLate = false;
    }
    
    const violations = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;
    
    return {
      id: `student-${i + 1}`,
      name: students[i],
      email: students[i].toLowerCase().replace(' ', '.') + '@university.edu',
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      status: score >= 60 ? 'passed' : 'failed',
      submittedAt: `2025-11-${10 + Math.floor(i / 5)} ${9 + Math.floor(i / 3)}:${15 + (i % 4) * 10}:00`,
      timeTaken,
      violations,
      isLate,
    };
  }).sort((a, b) => b.score - a.score);
};

const COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444'];

export function ExamResultsModal({ exam, onClose }: ExamResultsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const studentResults = useMemo(() => generateStudentResults(exam.id, exam.completedStudents, exam.duration), [exam.id, exam.completedStudents, exam.duration]);

  // Calculate statistics
  const passedStudents = studentResults.filter(s => s.status === 'passed').length;
  const failedStudents = studentResults.filter(s => s.status === 'failed').length;
  const averageScore = exam.averageScore || 0;
  const highestScore = Math.max(...studentResults.map(s => s.score));
  const lowestScore = Math.min(...studentResults.map(s => s.score));
  const totalViolations = studentResults.reduce((sum, s) => sum + s.violations, 0);
  const lateSubmissions = studentResults.filter(s => s.isLate).length;
  const onTimeSubmissions = studentResults.filter(s => !s.isLate).length;
  
  // Calculate average time from actual student results
  const averageTime = studentResults.length > 0 
    ? Math.round(studentResults.reduce((sum, s) => sum + s.timeTaken, 0) / studentResults.length)
    : 0;

  // Score distribution data
  const scoreDistribution = [
    { range: '90-100', count: studentResults.filter(s => s.score >= 90).length, fill: '#14b8a6' },
    { range: '80-89', count: studentResults.filter(s => s.score >= 80 && s.score < 90).length, fill: '#3b82f6' },
    { range: '70-79', count: studentResults.filter(s => s.score >= 70 && s.score < 80).length, fill: '#f59e0b' },
    { range: '<70', count: studentResults.filter(s => s.score < 70).length, fill: '#ef4444' },
  ];

  // Grade distribution for pie chart
  const gradeDistribution = [
    { name: 'A (90-100)', value: studentResults.filter(s => s.grade === 'A').length },
    { name: 'B (80-89)', value: studentResults.filter(s => s.grade === 'B').length },
    { name: 'C (70-79)', value: studentResults.filter(s => s.grade === 'C').length },
    { name: 'D/F (<70)', value: studentResults.filter(s => s.grade === 'D' || s.grade === 'F').length },
  ];

  // Filter students
  const filteredStudents = studentResults
    .filter(student => 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(student => filterGrade === 'all' || student.grade === filterGrade);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl my-8 flex flex-col max-h-[95vh]">
        {/* Header with Gradient */}
        <div className="relative bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white rounded-t-2xl flex-shrink-0">
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
              <BarChart3 className="size-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl mb-2">Exam Results & Analytics</h2>
              <p className="text-white/90 text-lg">{exam.title}</p>
              <p className="text-white/80 text-sm">{exam.subject}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-white/90">
                <span className="flex items-center gap-1">
                  <Calendar className="size-4" />
                  {new Date(exam.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {exam.duration} min
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Users className="size-4" />
                <span className="text-xs">Total Students</span>
              </div>
              <p className="text-2xl text-gray-800">{exam.completedStudents}</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl border border-teal-200">
              <div className="flex items-center gap-2 text-teal-700 mb-1">
                <Target className="size-4" />
                <span className="text-xs">Average Score</span>
              </div>
              <p className="text-2xl text-gray-800">{averageScore.toFixed(1)}%</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <TrendingUp className="size-4" />
                <span className="text-xs">Passed</span>
              </div>
              <p className="text-2xl text-gray-800">{passedStudents}</p>
              <p className="text-xs text-gray-600">
                {((passedStudents / exam.completedStudents) * 100).toFixed(0)}%
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <TrendingDown className="size-4" />
                <span className="text-xs">Failed</span>
              </div>
              <p className="text-2xl text-gray-800">{failedStudents}</p>
              <p className="text-xs text-gray-600">
                {((failedStudents / exam.completedStudents) * 100).toFixed(0)}%
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 text-purple-700 mb-1">
                <Award className="size-4" />
                <span className="text-xs">Highest Score</span>
              </div>
              <p className="text-2xl text-gray-800">{highestScore}%</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <TrendingDown className="size-4" />
                <span className="text-xs">Lowest Score</span>
              </div>
              <p className="text-2xl text-gray-800">{lowestScore}%</p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                <PieChart className="size-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="students">
                <Users className="size-4 mr-2" />
                Student Results
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="size-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Distribution Bar Chart */}
                <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg text-gray-800 mb-4">Score Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="range" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Grade Distribution Pie Chart */}
                <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg text-gray-800 mb-4">Grade Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <Award className="size-5" />
                    <h4 className="font-medium">Excellence Rate</h4>
                  </div>
                  <p className="text-3xl text-gray-800 mb-1">
                    {((studentResults.filter(s => s.score >= 90).length / exam.completedStudents) * 100).toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Students scored 90% or higher</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <Clock className="size-5" />
                    <h4 className="font-medium">Avg Time Taken</h4>
                  </div>
                  <p className="text-3xl text-gray-800 mb-1">
                    {averageTime} min
                  </p>
                  <p className="text-sm text-gray-600">Out of {exam.duration} minutes</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <TrendingDown className="size-5" />
                    <h4 className="font-medium">Violations</h4>
                  </div>
                  <p className="text-3xl text-gray-800 mb-1">{totalViolations}</p>
                  <p className="text-sm text-gray-600">Total security violations detected</p>
                </div>
              </div>
            </TabsContent>

            {/* Student Results Tab */}
            <TabsContent value="students" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterGrade} onValueChange={setFilterGrade}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    <SelectItem value="A">Grade A</SelectItem>
                    <SelectItem value="B">Grade B</SelectItem>
                    <SelectItem value="C">Grade C</SelectItem>
                    <SelectItem value="D">Grade D</SelectItem>
                    <SelectItem value="F">Grade F</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Download className="size-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              {/* Student List Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Rank</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Student</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Score</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Grade</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Time Taken</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Violations</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((student, index) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-blue-100 text-teal-700 text-sm">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-800">{student.name}</p>
                              <p className="text-xs text-gray-500">{student.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-lg text-gray-800">{student.score}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={
                                student.grade === 'A'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : student.grade === 'B'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : student.grade === 'C'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-red-100 text-red-700 border-red-200'
                              }
                            >
                              {student.grade}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={
                                student.status === 'passed'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : 'bg-red-100 text-red-700 border-red-200'
                              }
                            >
                              {student.status === 'passed' ? 'Passed' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <span>{student.timeTaken} min</span>
                              {student.isLate && (
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                                  Late
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {student.violations > 0 ? (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                                {student.violations}
                              </Badge>
                            ) : (
                              <span className="text-sm text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                <Eye className="size-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                                <Mail className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No students found matching your filters
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              {/* Question Performance (Mock Data) */}
              <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg text-gray-800 mb-4">Top 5 Most Difficult Questions</h3>
                <div className="space-y-3">
                  {[
                    { q: 'Question 12: Advanced SQL Joins', correct: 45 },
                    { q: 'Question 8: Database Normalization', correct: 52 },
                    { q: 'Question 25: Transaction Management', correct: 58 },
                    { q: 'Question 15: Index Optimization', correct: 63 },
                    { q: 'Question 20: Query Performance', correct: 67 },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{item.q}</span>
                          <span className="text-sm text-gray-600">{item.correct}% correct</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              item.correct < 50
                                ? 'bg-red-500'
                                : item.correct < 70
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${item.correct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Completion Timeline */}
              <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg text-gray-800 mb-4">Submission Timeline</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">First 30 minutes</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="w-1/4 bg-teal-500 h-2 rounded-full" />
                      </div>
                      <span className="text-gray-800 w-8">25%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">30-60 minutes</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="w-1/2 bg-blue-500 h-2 rounded-full" />
                      </div>
                      <span className="text-gray-800 w-8">50%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">60-90 minutes</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="w-3/4 bg-purple-500 h-2 rounded-full" />
                      </div>
                      <span className="text-gray-800 w-8">20%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Late submissions</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="w-1/12 bg-red-500 h-2 rounded-full" />
                      </div>
                      <span className="text-gray-800 w-8">5%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="px-6">
            <ArrowLeft className="size-4 mr-2" />
            Close
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="hover:bg-green-50 hover:border-green-300 border-green-200"
            >
              <Download className="size-4 mr-2" />
              Export Full Report
            </Button>
            <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 shadow-lg">
              <Mail className="size-4 mr-2" />
              Send Results to Students
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}