export interface ExamResult {
  id: string;
  examTitle: string;
  subject: string;
  date: string;
  duration: string;
  status: 'published' | 'pending' | 'hidden';
  score?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  timeTaken?: string;
  allowViewDetails: boolean;
  scoreVisible?: boolean; // Whether instructor allows students to see the score
  questions?: ExamQuestion[];
}

export interface ExamQuestion {
  id: string;
  type: 'mcq' | 'essay';
  question: string;
  options?: string[]; // For MCQ only
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  topic?: string;
}

export const mockExamResults: ExamResult[] = [
  {
    id: '1',
    examTitle: 'Final Exam - Database Systems',
    subject: 'Database Systems',
    date: '2025-11-01',
    duration: '120 mins',
    status: 'published',
    score: 85,
    totalQuestions: 50,
    correctAnswers: 42,
    timeTaken: '105 mins',
    allowViewDetails: true,
    scoreVisible: true, // Instructor allows students to see the score
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        question: 'What is normalization in database design?',
        options: [
          'The process of organizing data to reduce redundancy',
          'The process of adding more tables to a database',
          'The process of encrypting database data',
          'The process of backing up database regularly',
        ],
        studentAnswer: 'The process of organizing data to reduce redundancy',
        correctAnswer: 'The process of organizing data to reduce redundancy',
        isCorrect: true,
        topic: 'Database Design',
      },
      {
        id: 'q2',
        type: 'mcq',
        question: 'Which SQL command is used to retrieve data?',
        options: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
        studentAnswer: 'SELECT',
        correctAnswer: 'SELECT',
        isCorrect: true,
        topic: 'SQL',
      },
      {
        id: 'q3',
        type: 'essay',
        question: 'Explain what ACID properties mean in database transactions and why they are important.',
        studentAnswer: 'ACID stands for Atomicity, Consistency, Isolation, Durability. These properties ensure database transactions are processed reliably. Atomicity means all operations complete or none do. Consistency ensures the database remains in a valid state. Isolation means concurrent transactions don\'t interfere with each other. Durability ensures committed transactions persist even after system failures.',
        correctAnswer: 'ACID stands for Atomicity, Consistency, Isolation, Durability. These are fundamental properties that ensure database transactions are processed reliably and maintain data integrity.',
        isCorrect: true,
        topic: 'Transactions',
      },
      {
        id: 'q4',
        type: 'mcq',
        question: 'What is a primary key in a relational database?',
        options: [
          'A unique identifier for each record in a table',
          'The first column in a table',
          'A key used for encryption',
          'A foreign key reference',
        ],
        studentAnswer: 'A unique identifier for each record in a table',
        correctAnswer: 'A unique identifier for each record in a table',
        isCorrect: true,
        topic: 'Database Design',
      },
    ],
  },
  {
    id: '2',
    examTitle: 'Midterm Exam - Operating Systems',
    subject: 'Operating Systems',
    date: '2025-10-25',
    duration: '90 mins',
    status: 'published',
    score: 78,
    totalQuestions: 40,
    correctAnswers: 31,
    timeTaken: '85 mins',
    allowViewDetails: true,
    scoreVisible: true, // Instructor allows students to see the score
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        question: 'What is a process in an operating system?',
        options: [
          'A program in execution',
          'A stored program on disk',
          'A system file',
          'A user interface',
        ],
        studentAnswer: 'A program in execution',
        correctAnswer: 'A program in execution',
        isCorrect: true,
        topic: 'Processes',
      },
      {
        id: 'q2',
        type: 'mcq',
        question: 'What does FCFS stand for in scheduling algorithms?',
        options: [
          'First Come First Served',
          'First In First Out',
          'Fast Context Free Scheduling',
          'First Call First System',
        ],
        studentAnswer: 'First In First Out',
        correctAnswer: 'First Come First Served',
        isCorrect: false,
        topic: 'Scheduling',
      },
      {
        id: 'q3',
        type: 'essay',
        question: 'Describe the difference between a process and a thread.',
        studentAnswer: 'A process is an independent program with its own memory space, while a thread is a lightweight unit of execution within a process that shares the process memory.',
        correctAnswer: 'A process is an independent program execution with its own memory space and resources. A thread is a lightweight execution unit within a process that shares the process\'s memory and resources, allowing for more efficient multitasking.',
        isCorrect: true,
        topic: 'Processes',
      },
    ],
  },
  {
    id: '3',
    examTitle: 'Quiz - Data Structures',
    subject: 'Data Structures',
    date: '2025-10-20',
    duration: '45 mins',
    status: 'published',
    score: 92,
    totalQuestions: 25,
    correctAnswers: 23,
    timeTaken: '40 mins',
    allowViewDetails: false,
    scoreVisible: true, // Instructor allows students to see the score
  },
  {
    id: '4',
    examTitle: 'Midterm Exam - Web Development',
    subject: 'Web Development',
    date: '2025-10-15',
    duration: '90 mins',
    status: 'pending',
    allowViewDetails: false,
    scoreVisible: false, // Instructor does not allow students to see the score
  },
  {
    id: '5',
    examTitle: 'Final Exam - Computer Networks',
    subject: 'Computer Networks',
    date: '2025-10-10',
    duration: '120 mins',
    status: 'published',
    score: 88,
    totalQuestions: 50,
    correctAnswers: 44,
    timeTaken: '110 mins',
    allowViewDetails: true,
    scoreVisible: true, // Instructor allows students to see the score
  },
  {
    id: '6',
    examTitle: 'Quiz - Software Engineering',
    subject: 'Software Engineering',
    date: '2025-10-05',
    duration: '30 mins',
    status: 'hidden',
    allowViewDetails: false,
    scoreVisible: false, // Instructor does not allow students to see the score
  },
  {
    id: '7',
    examTitle: 'Midterm Exam - Algorithms',
    subject: 'Algorithms',
    date: '2025-09-28',
    duration: '90 mins',
    status: 'published',
    score: 95,
    totalQuestions: 40,
    correctAnswers: 38,
    timeTaken: '80 mins',
    allowViewDetails: true,
    scoreVisible: true, // Instructor allows students to see the score
  },
  {
    id: '8',
    examTitle: 'Quiz - Machine Learning',
    subject: 'Machine Learning',
    date: '2025-09-20',
    duration: '45 mins',
    status: 'published',
    score: 82,
    totalQuestions: 30,
    correctAnswers: 25,
    timeTaken: '42 mins',
    allowViewDetails: true,
    scoreVisible: false, // Instructor does not allow students to see the score
  },
];