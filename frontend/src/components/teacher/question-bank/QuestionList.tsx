import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  CheckSquare,
  Circle,
  FileText,
  Link2,
  MoreVertical,
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  BookOpen,
} from 'lucide-react';

interface Question {
  id: string;
  type: 'mcq' | 'true-false' | 'essay' | 'matching';
  question: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  answerCount?: number;
  createdAt: string;
  createdBy: string;
  usageCount: number;
}

const mockQuestions: Question[] = [
  {
    id: '1',
    type: 'mcq',
    question: 'What is normalization in database design?',
    subject: 'Database Systems',
    chapter: 'Chapter 3: Database Design',
    difficulty: 'medium',
    tags: ['normalization', 'design'],
    answerCount: 4,
    createdAt: '2025-11-10',
    createdBy: 'Prof. Anderson',
    usageCount: 5,
  },
  {
    id: '2',
    type: 'true-false',
    question: 'A primary key can contain NULL values.',
    subject: 'Database Systems',
    chapter: 'Chapter 2: SQL Basics',
    difficulty: 'easy',
    tags: ['sql', 'primary-key'],
    createdAt: '2025-11-12',
    createdBy: 'Prof. Anderson',
    usageCount: 8,
  },
  {
    id: '3',
    type: 'essay',
    question: 'Explain the ACID properties of database transactions with examples.',
    subject: 'Database Systems',
    chapter: 'Chapter 5: Transactions',
    difficulty: 'hard',
    tags: ['transactions', 'acid'],
    createdAt: '2025-11-08',
    createdBy: 'Prof. Anderson',
    usageCount: 3,
  },
  {
    id: '4',
    type: 'matching',
    question: 'Match the SQL commands with their categories.',
    subject: 'Database Systems',
    chapter: 'Chapter 2: SQL Basics',
    difficulty: 'medium',
    tags: ['sql', 'commands'],
    answerCount: 6,
    createdAt: '2025-11-14',
    createdBy: 'Prof. Anderson',
    usageCount: 2,
  },
  {
    id: '5',
    type: 'mcq',
    question: 'Which HTML tag is used to define a hyperlink?',
    subject: 'Web Development',
    chapter: 'Chapter 1: HTML Basics',
    difficulty: 'easy',
    tags: ['html', 'basics'],
    answerCount: 4,
    createdAt: '2025-11-09',
    createdBy: 'Prof. Anderson',
    usageCount: 12,
  },
  {
    id: '6',
    type: 'mcq',
    question: 'What does CSS stand for?',
    subject: 'Web Development',
    chapter: 'Chapter 2: CSS Basics',
    difficulty: 'easy',
    tags: ['css', 'basics'],
    answerCount: 4,
    createdAt: '2025-11-11',
    createdBy: 'Prof. Anderson',
    usageCount: 15,
  },
  {
    id: '7',
    type: 'essay',
    question: 'Explain the box model in CSS with examples.',
    subject: 'Web Development',
    chapter: 'Chapter 2: CSS Basics',
    difficulty: 'medium',
    tags: ['css', 'box-model'],
    createdAt: '2025-11-13',
    createdBy: 'Prof. Anderson',
    usageCount: 6,
  },
  {
    id: '8',
    type: 'mcq',
    question: 'What is the time complexity of binary search?',
    subject: 'Data Structures',
    chapter: 'Chapter 4: Searching',
    difficulty: 'medium',
    tags: ['algorithms', 'search'],
    answerCount: 4,
    createdAt: '2025-11-07',
    createdBy: 'Prof. Anderson',
    usageCount: 9,
  },
  {
    id: '9',
    type: 'true-false',
    question: 'A stack follows FIFO (First In First Out) principle.',
    subject: 'Data Structures',
    chapter: 'Chapter 2: Stacks',
    difficulty: 'easy',
    tags: ['stack', 'basics'],
    createdAt: '2025-11-14',
    createdBy: 'Prof. Anderson',
    usageCount: 11,
  },
  {
    id: '10',
    type: 'mcq',
    question: 'Which sorting algorithm has the best average time complexity?',
    subject: 'Algorithms',
    chapter: 'Chapter 3: Sorting',
    difficulty: 'hard',
    tags: ['sorting', 'complexity'],
    answerCount: 4,
    createdAt: '2025-11-06',
    createdBy: 'Prof. Anderson',
    usageCount: 4,
  },
];

const typeConfig = {
  mcq: { icon: CheckSquare, label: 'MCQ', color: 'bg-blue-100 text-blue-700' },
  'true-false': { icon: Circle, label: 'T/F', color: 'bg-purple-100 text-purple-700' },
  essay: { icon: FileText, label: 'Essay', color: 'bg-amber-100 text-amber-700' },
  matching: { icon: Link2, label: 'Match', color: 'bg-green-100 text-green-700' },
};

const difficultyConfig = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-700' },
};

interface QuestionListProps {
  selectedSubject: string;
  searchQuery: string;
  filters: any;
  readOnly?: boolean;
}

export function QuestionList({ selectedSubject, searchQuery, filters, readOnly = false }: QuestionListProps) {

  // Filter questions based on subject, search query, and filters
  const filteredQuestions = mockQuestions.filter((question) => {
    // Filter by selected subject
    if (selectedSubject !== 'all' && question.subject !== getSubjectName(selectedSubject)) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !question.question.toLowerCase().includes(query) &&
        !question.subject.toLowerCase().includes(query) &&
        !question.chapter.toLowerCase().includes(query) &&
        !question.tags.some((tag) => tag.toLowerCase().includes(query))
      ) {
        return false;
      }
    }

    // Filter by question types
    if (filters.questionTypes?.length > 0 && !filters.questionTypes.includes(question.type)) {
      return false;
    }

    // Filter by difficulty
    if (filters.difficulty?.length > 0 && !filters.difficulty.includes(question.difficulty)) {
      return false;
    }

    // Filter by tags
    if (filters.tags?.length > 0) {
      const hasMatchingTag = filters.tags.some((tag: string) =>
        question.tags.some((qTag) => qTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });

  function getSubjectName(subjectId: string): string {
    const subjectMap: Record<string, string> = {
      database: 'Database Systems',
      web: 'Web Development',
      datastructures: 'Data Structures',
      algorithms: 'Algorithms',
    };
    return subjectMap[subjectId] || '';
  }

  return (
    <div className="space-y-4">
      {/* Results Count */}
      <div className="px-2">
        <p className="text-sm text-gray-600">
          Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Question Cards */}
      <div className="space-y-3">
        {filteredQuestions.map((question) => {
          const typeInfo = typeConfig[question.type];
          const TypeIcon = typeInfo.icon;
          const difficultyInfo = difficultyConfig[question.difficulty];

          return (
            <Card
              key={question.id}
              className="shadow-md rounded-2xl border-0 transition-all hover:shadow-lg"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Question Text */}
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-gray-800 flex-1 line-clamp-2">{question.question}</p>
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="size-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="size-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {readOnly && (
                        <Button variant="ghost" size="sm">
                          <Eye className="size-4" />
                        </Button>
                      )}
                    </div>

                    {/* Badges & Metadata */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={typeInfo.color}>
                        <TypeIcon className="size-3 mr-1" />
                        {typeInfo.label}
                      </Badge>
                      <Badge variant="outline" className={difficultyInfo.color}>
                        {difficultyInfo.label}
                      </Badge>
                      {question.answerCount && (
                        <span className="text-xs text-gray-500">
                          {question.answerCount} options
                        </span>
                      )}
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">Used {question.usageCount}x</span>
                    </div>

                    {/* Tags */}
                    {question.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {question.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs bg-gray-50 text-gray-600"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Bottom Info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <BookOpen className="size-3" />
                        {question.chapter}
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <User className="size-3" />
                        {question.createdBy}
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(question.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No questions found</p>
          <p className="text-sm text-gray-400 mt-2">Try adjusting your filters or add new questions</p>
        </div>
      )}
    </div>
  );
}