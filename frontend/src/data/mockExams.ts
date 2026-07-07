import { ExamSettings } from '../types/examSettings';

export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  time: string;
  duration: string;
  status: 'upcoming' | 'open' | 'completed';
  examCode?: string;
  codeValidUntil?: string;
  allowViewDetails?: boolean; // For completed exams - whether student can view detailed results
  scoreVisible?: boolean; // For completed exams - whether score is visible to student
  settings?: ExamSettings;
}

export const mockExams: Exam[] = [
  {
    id: '1',
    title: 'Midterm Exam - Database Systems',
    subject: 'Database Systems',
    date: '2025-11-15',
    time: '09:00 AM',
    duration: '90 mins',
    status: 'open',
    examCode: 'EXAM2025',
    codeValidUntil: '2025-11-15 10:00 AM',
  },
  {
    id: '2',
    title: 'Final Exam - Web Development',
    subject: 'Web Development',
    date: '2025-11-20',
    time: '02:00 PM',
    duration: '120 mins',
    status: 'upcoming',
    examCode: 'WEB2025F',
    codeValidUntil: '2025-11-20 02:15 PM',
  },
  {
    id: '3',
    title: 'Quiz - Operating Systems',
    subject: 'Operating Systems',
    date: '2025-11-10',
    time: '10:00 AM',
    duration: '45 mins',
    status: 'completed',
    allowViewDetails: true,
    scoreVisible: true,
  },
  {
    id: '4',
    title: 'Midterm Exam - Data Structures',
    subject: 'Data Structures',
    date: '2025-11-18',
    time: '01:00 PM',
    duration: '90 mins',
    status: 'upcoming',
    examCode: 'DS2025M',
    codeValidUntil: '2025-11-18 01:15 PM',
  },
  {
    id: '5',
    title: 'Final Exam - Computer Networks',
    subject: 'Computer Networks',
    date: '2025-11-05',
    time: '03:00 PM',
    duration: '120 mins',
    status: 'completed',
    allowViewDetails: true,
    scoreVisible: true,
  },
  {
    id: '6',
    title: 'Quiz - Algorithms',
    subject: 'Algorithms',
    date: '2025-11-08',
    time: '11:00 AM',
    duration: '45 mins',
    status: 'completed',
    allowViewDetails: false,
    scoreVisible: true,
  },
  {
    id: '7',
    title: 'Midterm Exam - Machine Learning',
    subject: 'Machine Learning',
    date: '2025-11-03',
    time: '09:00 AM',
    duration: '90 mins',
    status: 'completed',
    allowViewDetails: true,
    scoreVisible: false,
  },
];