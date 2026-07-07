import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { useUserRole } from '../../contexts/UserRoleContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  Copy,
  BookMarked,
  ListChecks,
  FileText,
  Upload,
  GraduationCap,
  FolderTree,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'essay' | 'true-false';
  department: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options?: string[];
  correctAnswer?: string;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

interface Department {
  id: string;
  name: string;
  subjects: string[];
}

const mockDepartments: Department[] = [
  {
    id: '1',
    name: 'Computer Science',
    subjects: [
      'Database Systems',
      'Data Structures',
      'Algorithms',
      'Web Development',
      'Operating Systems',
    ],
  },
  {
    id: '2',
    name: 'Information Technology',
    subjects: [
      'Network Security',
      'Cloud Computing',
      'Mobile Development',
      'Software Engineering',
    ],
  },
  {
    id: '3',
    name: 'Business Administration',
    subjects: ['Marketing', 'Finance', 'Management', 'Economics'],
  },
  {
    id: '4',
    name: 'Mathematics',
    subjects: ['Calculus', 'Linear Algebra', 'Statistics', 'Discrete Math'],
  },
];

const mockQuestions: Question[] = [
  {
    id: '1',
    text: 'What is the primary key in a relational database?',
    type: 'multiple-choice',
    department: 'Computer Science',
    subject: 'Database Systems',
    chapter: 'Chapter 1: Introduction to Databases',
    difficulty: 'easy',
    options: [
      'A column that contains duplicate values',
      'A unique identifier for each row in a table',
      'A foreign key reference',
      'An index for faster searches',
    ],
    correctAnswer: 'A unique identifier for each row in a table',
    createdBy: 'Dr. Smith',
    createdAt: '2024-09-15',
    usageCount: 15,
  },
  {
    id: '2',
    text: 'Which normal form eliminates partial dependencies?',
    type: 'multiple-choice',
    department: 'Computer Science',
    subject: 'Database Systems',
    chapter: 'Chapter 3: Normalization',
    difficulty: 'medium',
    options: [
      'First Normal Form (1NF)',
      'Second Normal Form (2NF)',
      'Third Normal Form (3NF)',
      'Boyce-Codd Normal Form (BCNF)',
    ],
    correctAnswer: 'Second Normal Form (2NF)',
    createdBy: 'Dr. Smith',
    createdAt: '2024-09-15',
    usageCount: 12,
  },
  {
    id: '3',
    text: 'Explain the difference between INNER JOIN and LEFT JOIN with examples.',
    type: 'essay',
    department: 'Computer Science',
    subject: 'Database Systems',
    chapter: 'Chapter 4: SQL Joins',
    difficulty: 'hard',
    createdBy: 'Dr. Smith',
    createdAt: '2024-09-20',
    usageCount: 8,
  },
  {
    id: '4',
    text: 'Arrays in JavaScript are zero-indexed.',
    type: 'true-false',
    department: 'Computer Science',
    subject: 'Web Development',
    chapter: 'Chapter 2: JavaScript Basics',
    difficulty: 'easy',
    correctAnswer: 'True',
    createdBy: 'Prof. Johnson',
    createdAt: '2024-10-01',
    usageCount: 20,
  },
  {
    id: '5',
    text: 'What is time complexity of binary search?',
    type: 'multiple-choice',
    department: 'Computer Science',
    subject: 'Data Structures',
    chapter: 'Chapter 5: Searching Algorithms',
    difficulty: 'medium',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correctAnswer: 'O(log n)',
    createdBy: 'Dr. Williams',
    createdAt: '2024-10-10',
    usageCount: 18,
  },
  {
    id: '6',
    text: 'What is a stack data structure?',
    type: 'multiple-choice',
    department: 'Computer Science',
    subject: 'Data Structures',
    chapter: 'Chapter 2: Linear Data Structures',
    difficulty: 'easy',
    options: [
      'FIFO structure',
      'LIFO structure',
      'Random access structure',
      'Tree structure',
    ],
    correctAnswer: 'LIFO structure',
    createdBy: 'Dr. Williams',
    createdAt: '2024-10-12',
    usageCount: 25,
  },
];

export function AdminQuestionBankPage() {
  const { isAdmin } = useUserRole();
  const [departments] = useState<Department[]>(mockDepartments);
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  
  // Navigation state
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Form states
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState<'multiple-choice' | 'essay' | 'true-false'>('multiple-choice');
  const [formChapter, setFormChapter] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [formOptions, setFormOptions] = useState(['', '', '', '']);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Get filtered questions for selected subject
  const subjectQuestions = questions.filter(
    (q) => q.department === selectedDepartment && q.subject === selectedSubject
  );

  // Get unique chapters for selected subject
  const chapters = Array.from(new Set(subjectQuestions.map((q) => q.chapter))).sort();

  const filteredQuestions = subjectQuestions.filter((q) => {
    const matchesSearch =
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.chapter.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChapter = chapterFilter === 'all' || q.chapter === chapterFilter;
    const matchesType = typeFilter === 'all' || q.type === typeFilter;
    const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    return matchesSearch && matchesChapter && matchesType && matchesDifficulty;
  });

  const resetForm = () => {
    setFormText('');
    setFormType('multiple-choice');
    setFormChapter('');
    setFormDifficulty('easy');
    setFormOptions(['', '', '', '']);
    setFormCorrectAnswer('');
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `${Date.now()}`,
      text: formText,
      type: formType,
      department: selectedDepartment,
      subject: selectedSubject,
      chapter: formChapter,
      difficulty: formDifficulty,
      createdBy: 'Admin User',
      createdAt: new Date().toISOString().split('T')[0],
      usageCount: 0,
      ...(formType === 'multiple-choice' && {
        options: formOptions.filter((o) => o.trim() !== ''),
        correctAnswer: formCorrectAnswer,
      }),
      ...(formType === 'true-false' && {
        correctAnswer: formCorrectAnswer,
      }),
    };

    setQuestions([...questions, newQuestion]);
    setShowAddDialog(false);
    resetForm();
    toast.success('Question added successfully');
  };

  const handleEditQuestion = () => {
    if (!selectedQuestion) return;

    setQuestions(
      questions.map((q) =>
        q.id === selectedQuestion.id
          ? {
              ...q,
              text: formText,
              type: formType,
              chapter: formChapter,
              difficulty: formDifficulty,
              ...(formType === 'multiple-choice' && {
                options: formOptions.filter((o) => o.trim() !== ''),
                correctAnswer: formCorrectAnswer,
              }),
              ...(formType === 'true-false' && {
                correctAnswer: formCorrectAnswer,
              }),
            }
          : q
      )
    );

    setShowEditDialog(false);
    setSelectedQuestion(null);
    resetForm();
    toast.success('Question updated successfully');
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
    toast.success('Question deleted successfully');
  };

  const handleDuplicateQuestion = (question: Question) => {
    const newQuestion: Question = {
      ...question,
      id: `${Date.now()}`,
      text: `${question.text} (Copy)`,
      usageCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setQuestions([...questions, newQuestion]);
    toast.success('Question duplicated successfully');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (validTypes.includes(file.type)) {
        setUploadedFile(file);
        toast.success(`File "${file.name}" uploaded successfully`);
      } else {
        toast.error('Please upload PDF or Word documents only');
      }
    }
  };

  const handleProcessUpload = () => {
    if (!uploadedFile) {
      toast.error('Please select a file first');
      return;
    }

    // Simulate file processing
    toast.success('Processing file... This may take a moment');
    
    setTimeout(() => {
      // Mock: Add questions from file
      const mockImportedQuestions: Question[] = [
        {
          id: `${Date.now()}-1`,
          text: 'What is a foreign key constraint?',
          type: 'multiple-choice',
          department: selectedDepartment,
          subject: selectedSubject,
          chapter: formChapter || 'Imported Chapter',
          difficulty: 'medium',
          options: [
            'A constraint that enforces uniqueness',
            'A constraint that links two tables',
            'A constraint that prevents null values',
            'A constraint that sets default values',
          ],
          correctAnswer: 'A constraint that links two tables',
          createdBy: 'Admin User (Imported)',
          createdAt: new Date().toISOString().split('T')[0],
          usageCount: 0,
        },
        {
          id: `${Date.now()}-2`,
          text: 'Explain the ACID properties in database transactions.',
          type: 'essay',
          department: selectedDepartment,
          subject: selectedSubject,
          chapter: formChapter || 'Imported Chapter',
          difficulty: 'hard',
          createdBy: 'Admin User (Imported)',
          createdAt: new Date().toISOString().split('T')[0],
          usageCount: 0,
        },
      ];

      setQuestions([...questions, ...mockImportedQuestions]);
      setShowUploadDialog(false);
      setUploadedFile(null);
      setFormChapter('');
      toast.success(`Successfully imported ${mockImportedQuestions.length} questions`);
    }, 2000);
  };

  const openEditDialog = (question: Question) => {
    setSelectedQuestion(question);
    setFormText(question.text);
    setFormType(question.type);
    setFormChapter(question.chapter);
    setFormDifficulty(question.difficulty);
    if (question.options) {
      setFormOptions([...question.options, '', '', '', ''].slice(0, 4));
    }
    if (question.correctAnswer) {
      setFormCorrectAnswer(question.correctAnswer);
    }
    setShowEditDialog(true);
  };

  const openViewDialog = (question: Question) => {
    setSelectedQuestion(question);
    setShowViewDialog(true);
  };

  const handleBackToSubjects = () => {
    setSelectedSubject('');
    setSearchQuery('');
    setChapterFilter('all');
    setTypeFilter('all');
    setDifficultyFilter('all');
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment('');
    setSelectedSubject('');
    setSearchQuery('');
    setChapterFilter('all');
    setTypeFilter('all');
    setDifficultyFilter('all');
  };

  const getDifficultyBadge = (difficulty: string) => {
    const styles = {
      easy: 'bg-green-100 text-green-700 border-green-300',
      medium: 'bg-amber-100 text-amber-700 border-amber-300',
      hard: 'bg-red-100 text-red-700 border-red-300',
    };
    return styles[difficulty as keyof typeof styles] || styles.easy;
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      'multiple-choice': 'bg-blue-100 text-blue-700 border-blue-300',
      essay: 'bg-purple-100 text-purple-700 border-purple-300',
      'true-false': 'bg-teal-100 text-teal-700 border-teal-300',
    };
    return styles[type as keyof typeof styles] || styles['multiple-choice'];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple-choice':
        return <ListChecks className="size-4" />;
      case 'essay':
        return <FileText className="size-4" />;
      case 'true-false':
        return <BookMarked className="size-4" />;
      default:
        return <BookOpen className="size-4" />;
    }
  };

  // Department Selection View
  if (!selectedDepartment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-6">
            <h1 className="text-3xl text-gray-900 mb-2">Question Bank Management</h1>
            <p className="text-gray-600">Select a department to manage questions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <Card
                key={dept.id}
                className="p-6 bg-white border border-gray-200 shadow-md hover:shadow-xl hover:border-red-300 transition-all cursor-pointer group"
                onClick={() => setSelectedDepartment(dept.name)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                    <GraduationCap className="size-6 text-white" />
                  </div>
                  <ChevronRight className="size-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                </div>

                <h3 className="text-xl text-gray-900 mb-2">{dept.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{dept.subjects.length} subjects</p>

                <div className="flex flex-wrap gap-1">
                  {dept.subjects.slice(0, 3).map((subject, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {subject}
                    </Badge>
                  ))}
                  {dept.subjects.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{dept.subjects.length - 3} more
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Subject Selection View
  if (!selectedSubject) {
    const currentDept = departments.find((d) => d.name === selectedDepartment);
    if (!currentDept) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <Button
            onClick={handleBackToDepartments}
            variant="ghost"
            className="mb-4 gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to Departments
          </Button>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <GraduationCap className="size-4" />
              <span>{selectedDepartment}</span>
            </div>
            <h1 className="text-3xl text-gray-900 mb-2">Select Subject</h1>
            <p className="text-gray-600">Choose a subject to view and manage questions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDept.subjects.map((subject, idx) => {
              const subjectQuestionCount = questions.filter(
                (q) => q.department === selectedDepartment && q.subject === subject
              ).length;

              return (
                <Card
                  key={idx}
                  className="p-5 bg-white border border-gray-200 shadow-md hover:shadow-xl hover:border-orange-300 transition-all cursor-pointer group"
                  onClick={() => setSelectedSubject(subject)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg group-hover:scale-110 transition-transform">
                      <FolderTree className="size-5 text-white" />
                    </div>
                    <ChevronRight className="size-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
                  </div>

                  <h3 className="text-lg text-gray-900 mb-2">{subject}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="size-4" />
                    <span>{subjectQuestionCount} questions</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Questions View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          onClick={handleBackToSubjects}
          variant="ghost"
          className="mb-4 gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Subjects
        </Button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <GraduationCap className="size-4" />
          <span>{selectedDepartment}</span>
          <ChevronRight className="size-3" />
          <FolderTree className="size-4" />
          <span>{selectedSubject}</span>
        </div>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-2">{selectedSubject}</h1>
          <p className="text-gray-600">Manage questions for this subject</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-white border border-gray-200 shadow-sm">
            <div className="text-2xl text-gray-900 mb-1">{subjectQuestions.length}</div>
            <div className="text-sm text-gray-600">Total Questions</div>
          </Card>
          <Card className="p-4 bg-white border border-gray-200 shadow-sm">
            <div className="text-2xl text-gray-900 mb-1">{chapters.length}</div>
            <div className="text-sm text-gray-600">Chapters</div>
          </Card>
          <Card className="p-4 bg-white border border-gray-200 shadow-sm">
            <div className="text-2xl text-gray-900 mb-1">
              {subjectQuestions.filter((q) => q.type === 'multiple-choice').length}
            </div>
            <div className="text-sm text-gray-600">Multiple Choice</div>
          </Card>
          <Card className="p-4 bg-white border border-gray-200 shadow-sm">
            <div className="text-2xl text-gray-900 mb-1">
              {subjectQuestions.filter((q) => q.type === 'essay').length}
            </div>
            <div className="text-sm text-gray-600">Essay Questions</div>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card className="p-4 bg-white border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Chapter Filter */}
            <Select value={chapterFilter} onValueChange={setChapterFilter}>
              <SelectTrigger className="w-full lg:w-56">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chapters</SelectItem>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter} value={chapter}>
                    {chapter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
                <SelectItem value="true-false">True/False</SelectItem>
              </SelectContent>
            </Select>

            {/* Difficulty Filter */}
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Button
                    onClick={() => setShowUploadDialog(true)}
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="size-4" />
                    <span className="hidden sm:inline">Upload File</span>
                  </Button>
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 gap-2"
                  >
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Add Question</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((question, index) => (
            <Card
              key={question.id}
              className="p-5 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Question Number */}
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-md">
                  <span className="text-lg">{index + 1}</span>
                </div>

                {/* Question Content */}
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {getTypeIcon(question.type)}
                    <Badge className={getTypeBadge(question.type)}>
                      {question.type.replace('-', ' ')}
                    </Badge>
                    <Badge className={getDifficultyBadge(question.difficulty)}>
                      {question.difficulty}
                    </Badge>
                    <span className="text-xs text-gray-500">• {question.chapter}</span>
                  </div>

                  {/* Question Text */}
                  <p className="text-gray-900 mb-3 line-clamp-2">{question.text}</p>

                  {/* Options Preview for Multiple Choice */}
                  {question.type === 'multiple-choice' && question.options && (
                    <div className="mb-3 space-y-1">
                      {question.options.slice(0, 2).map((option, idx) => (
                        <div key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs">
                            {String.fromCharCode(65 + idx)}
                          </div>
                          {option}
                        </div>
                      ))}
                      {question.options.length > 2 && (
                        <div className="text-xs text-gray-500 pl-7">
                          +{question.options.length - 2} more options
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Info */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Created by {question.createdBy}</span>
                    <span>•</span>
                    <span>{question.createdAt}</span>
                    <span>•</span>
                    <span>Used {question.usageCount} times</span>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openViewDialog(question)}>
                      <Eye className="size-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => openEditDialog(question)}>
                          <Edit className="size-4 mr-2" />
                          Edit Question
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateQuestion(question)}>
                          <Copy className="size-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}

          {filteredQuestions.length === 0 && (
            <Card className="p-12 text-center bg-white border border-gray-200">
              <BookOpen className="size-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">No questions found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your filters or add new questions
              </p>
            </Card>
          )}
        </div>

        {/* Upload File Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Questions from File</DialogTitle>
              <DialogDescription>
                Upload a PDF or Word document containing questions. The system will automatically
                parse and import them.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Chapter Selection */}
              <div>
                <Label htmlFor="upload-chapter">Chapter (Optional)</Label>
                <Input
                  id="upload-chapter"
                  placeholder="e.g., Chapter 1: Introduction"
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if the file contains chapter information
                </p>
              </div>

              {/* File Upload */}
              <div>
                <Label htmlFor="file-upload">Upload File</Label>
                <div className="mt-2 flex items-center justify-center w-full">
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="size-10 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-700">
                        <span className="font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF or Word documents (MAX. 10MB)</p>
                      {uploadedFile && (
                        <div className="mt-3 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">
                          ✓ {uploadedFile.name}
                        </div>
                      )}
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Supported File Formats:
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• PDF documents (.pdf)</li>
                  <li>• Microsoft Word (.doc, .docx)</li>
                </ul>
                <p className="text-xs text-blue-600 mt-3">
                  Note: The system will attempt to automatically detect question types and answers.
                  You may need to review and edit imported questions.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProcessUpload}
                className="bg-gradient-to-r from-red-500 to-orange-600"
                disabled={!uploadedFile}
              >
                <Upload className="size-4 mr-2" />
                Process & Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Question Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Question</DialogTitle>
              <DialogDescription>
                Create a new question for {selectedSubject}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="question-text">Question Text</Label>
                <Textarea
                  id="question-text"
                  placeholder="Enter the question..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Question Type</Label>
                  <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={formDifficulty} onValueChange={(v: any) => setFormDifficulty(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="chapter">Chapter</Label>
                <Input
                  id="chapter"
                  placeholder="e.g., Chapter 1: Introduction to Databases"
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                />
              </div>

              {formType === 'multiple-choice' && (
                <>
                  <div>
                    <Label>Answer Options</Label>
                    <div className="space-y-2">
                      {formOptions.map((option, idx) => (
                        <Input
                          key={idx}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...formOptions];
                            newOptions[idx] = e.target.value;
                            setFormOptions(newOptions);
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="correct-answer">Correct Answer</Label>
                    <Select value={formCorrectAnswer} onValueChange={setFormCorrectAnswer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions
                          .filter((o) => o.trim() !== '')
                          .map((option, idx) => (
                            <SelectItem key={idx} value={option}>
                              {String.fromCharCode(65 + idx)}: {option}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {formType === 'true-false' && (
                <div>
                  <Label htmlFor="tf-answer">Correct Answer</Label>
                  <Select value={formCorrectAnswer} onValueChange={setFormCorrectAnswer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="True">True</SelectItem>
                      <SelectItem value="False">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddQuestion}
                className="bg-gradient-to-r from-red-500 to-orange-600"
                disabled={!formText || !formChapter}
              >
                Add Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Question Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
              <DialogDescription>Update question details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-question-text">Question Text</Label>
                <Textarea
                  id="edit-question-text"
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-type">Question Type</Label>
                  <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-difficulty">Difficulty</Label>
                  <Select value={formDifficulty} onValueChange={(v: any) => setFormDifficulty(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-chapter">Chapter</Label>
                <Input
                  id="edit-chapter"
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                />
              </div>

              {formType === 'multiple-choice' && (
                <>
                  <div>
                    <Label>Answer Options</Label>
                    <div className="space-y-2">
                      {formOptions.map((option, idx) => (
                        <Input
                          key={idx}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...formOptions];
                            newOptions[idx] = e.target.value;
                            setFormOptions(newOptions);
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-correct-answer">Correct Answer</Label>
                    <Select value={formCorrectAnswer} onValueChange={setFormCorrectAnswer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions
                          .filter((o) => o.trim() !== '')
                          .map((option, idx) => (
                            <SelectItem key={idx} value={option}>
                              {String.fromCharCode(65 + idx)}: {option}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {formType === 'true-false' && (
                <div>
                  <Label htmlFor="edit-tf-answer">Correct Answer</Label>
                  <Select value={formCorrectAnswer} onValueChange={setFormCorrectAnswer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="True">True</SelectItem>
                      <SelectItem value="False">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditQuestion}
                className="bg-gradient-to-r from-red-500 to-orange-600"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Question Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Question Details</DialogTitle>
            </DialogHeader>

            {selectedQuestion && (
              <div className="space-y-4">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getTypeBadge(selectedQuestion.type)}>
                    {selectedQuestion.type.replace('-', ' ')}
                  </Badge>
                  <Badge className={getDifficultyBadge(selectedQuestion.difficulty)}>
                    {selectedQuestion.difficulty}
                  </Badge>
                  <Badge variant="outline">{selectedQuestion.chapter}</Badge>
                </div>

                {/* Question Text */}
                <div>
                  <Label>Question</Label>
                  <p className="text-gray-900 mt-2">{selectedQuestion.text}</p>
                </div>

                {/* Options */}
                {selectedQuestion.type === 'multiple-choice' && selectedQuestion.options && (
                  <div>
                    <Label>Answer Options</Label>
                    <div className="mt-2 space-y-2">
                      {selectedQuestion.options.map((option, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            option === selectedQuestion.correctAnswer
                              ? 'bg-green-50 border-green-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded border border-gray-400 flex items-center justify-center text-sm">
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="text-gray-900">{option}</span>
                            {option === selectedQuestion.correctAnswer && (
                              <Badge className="ml-auto bg-green-100 text-green-700 border-green-300">
                                Correct
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* True/False Answer */}
                {selectedQuestion.type === 'true-false' && (
                  <div>
                    <Label>Correct Answer</Label>
                    <p className="text-gray-900 mt-2 p-3 bg-green-50 border border-green-300 rounded-lg">
                      {selectedQuestion.correctAnswer}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <Label className="text-xs text-gray-500">Department</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.department}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Subject</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.subject}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Created By</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.createdBy}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Created Date</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.createdAt}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Usage Count</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.usageCount} times</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Question ID</Label>
                    <p className="text-sm text-gray-900">{selectedQuestion.id}</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
