import { useState, useEffect } from 'react';
import { ExamListSidebar } from './ExamListSidebar';
import { ExamEditor } from './ExamEditor';

interface Exam {
  id: string;
  title: string;
  subject: string;
  class: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  date: string;
  questionCount: number;
  assignedStudents: number;
  averageScore: number | null;
  duration?: number;
  examCode?: string;
  description?: string;
}

const initialExams: Exam[] = [
  {
    id: '1',
    title: 'Midterm Exam',
    subject: 'Database Systems',
    class: 'CS301',
    status: 'scheduled',
    date: '2025-11-20',
    questionCount: 45,
    assignedStudents: 52,
    averageScore: null,
    duration: 90,
    examCode: 'EXAM-DB301M',
    description: 'Comprehensive assessment covering chapters 1-5',
  },
  {
    id: '2',
    title: 'Quiz 3 - Normalization',
    subject: 'Database Systems',
    class: 'CS301',
    status: 'published',
    date: '2025-11-15',
    questionCount: 15,
    assignedStudents: 52,
    averageScore: 82.5,
    duration: 30,
    examCode: 'EXAM-DB301Q3',
    description: 'Quick assessment on database normalization',
  },
  {
    id: '3',
    title: 'Final Exam',
    subject: 'Data Structures',
    class: 'CS201',
    status: 'draft',
    date: '2025-12-10',
    questionCount: 60,
    assignedStudents: 0,
    averageScore: null,
    duration: 120,
    examCode: 'EXAM-DS201F',
    description: 'Comprehensive final examination',
  },
  {
    id: '4',
    title: 'HTML & CSS Basics',
    subject: 'Web Development',
    class: 'CS102',
    status: 'archived',
    date: '2025-11-01',
    questionCount: 20,
    assignedStudents: 38,
    averageScore: 88.3,
    duration: 45,
    examCode: 'EXAM-WEB102',
    description: 'Fundamentals of HTML5 and CSS3',
  },
];

interface ExamManagerPageProps {
  initialExamId?: string | null;
}

export function ExamManagerPage({ initialExamId }: ExamManagerPageProps) {
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(initialExamId || '1');

  // Update selectedExamId when initialExamId changes
  useEffect(() => {
    if (initialExamId) {
      setSelectedExamId(initialExamId);
    }
  }, [initialExamId]);

  const handleCreateNew = () => {
    const newId = `new-${Date.now()}`;
    setSelectedExamId(newId);
  };

  const handleSaveExam = (examData: {
    id: string;
    title: string;
    description: string;
    subject: string;
    class: string;
    duration: number;
    examCode: string;
    status: 'draft' | 'scheduled' | 'published' | 'archived';
  }) => {
    // If it's a new exam (id starts with 'new-')
    if (examData.id.startsWith('new-')) {
      const newExam: Exam = {
        id: Date.now().toString(), // Generate permanent ID
        title: examData.title,
        subject: examData.subject,
        class: examData.class,
        status: examData.status,
        date: new Date().toISOString().split('T')[0],
        questionCount: 0,
        assignedStudents: 0,
        averageScore: null,
        duration: examData.duration,
        examCode: examData.examCode,
        description: examData.description,
      };
      setExams([newExam, ...exams]);
      setSelectedExamId(newExam.id); // Switch to the new permanent ID
    } else {
      // Update existing exam
      setExams(exams.map(exam =>
        exam.id === examData.id
          ? {
              ...exam,
              title: examData.title,
              subject: examData.subject,
              class: examData.class,
              status: examData.status,
              duration: examData.duration,
              examCode: examData.examCode,
              description: examData.description,
            }
          : exam
      ));
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left Sidebar - 35% */}
      <div className="w-[35%] min-w-[320px] max-w-[500px]">
        <ExamListSidebar
          exams={exams}
          selectedExamId={selectedExamId}
          onSelectExam={setSelectedExamId}
          onCreateNew={handleCreateNew}
        />
      </div>

      {/* Right Editor - 65% */}
      <div className="flex-1">
        <ExamEditor
          examId={selectedExamId}
          onClose={() => setSelectedExamId(null)}
          onSave={handleSaveExam}
        />
      </div>
    </div>
  );
}