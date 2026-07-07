import { useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { RefreshCw, User, Shuffle } from 'lucide-react';

interface Question {
  id: string;
  type: 'mcq' | 'true-false' | 'essay' | 'matching';
  question: string;
  subject: string;
  knowledgeDomain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  options?: string[];
  correctAnswer?: number | number[] | string;
  hasMultipleCorrect?: boolean;
}

interface PoolConfig {
  subject: string;
  rules: {
    knowledgeDomain: string;
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
    available: number;
  }[];
  totalQuestions: number;
}

interface StudentQuestionPreviewProps {
  poolConfig: PoolConfig;
  questionBank: Question[];
  onClose: () => void;
}

export function StudentQuestionPreview({
  poolConfig,
  questionBank,
  onClose,
}: StudentQuestionPreviewProps) {
  const [studentId, setStudentId] = useState(1);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);

  // Seeded random number generator for reproducibility
  const seededRandom = (seed: number) => {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  };

  // Generate questions for a specific student
  const generateQuestionsForStudent = (id: number) => {
    const random = seededRandom(id);
    const selectedQuestions: Question[] = [];

    // Filter question bank by subject
    const filteredBank = questionBank.filter((q) =>
      poolConfig.subject === 'all' ? true : q.subject === poolConfig.subject
    );

    // Generate questions based on pool rules
    poolConfig.rules.forEach((rule) => {
      const availableQuestions = filteredBank.filter(
        (q) =>
          q.knowledgeDomain === rule.knowledgeDomain && q.difficulty === rule.difficulty
      );

      // Shuffle using seeded random
      const shuffled = [...availableQuestions].sort(() => random() - 0.5);

      // Take the required count
      selectedQuestions.push(...shuffled.slice(0, rule.count));
    });

    // Final shuffle of all selected questions
    const finalShuffled = [...selectedQuestions].sort(() => random() - 0.5);

    return finalShuffled;
  };

  // Generate questions when component mounts or student changes
  const handleGenerate = (id: number) => {
    const questions = generateQuestionsForStudent(id);
    setGeneratedQuestions(questions);
    setStudentId(id);
  };

  // Auto-generate for first student
  useState(() => {
    handleGenerate(1);
  });

  const difficultyColors = {
    easy: 'text-green-600 bg-green-50 border-green-300',
    medium: 'text-amber-600 bg-amber-50 border-amber-300',
    hard: 'text-red-600 bg-red-50 border-red-300',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl text-white flex items-center gap-2">
                <Shuffle className="size-5" />
                Student Question Preview
              </h2>
              <p className="text-sm text-white/90 mt-1">
                Preview how questions are randomized for each student
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <span className="text-xl">×</span>
            </Button>
          </div>
        </div>

        {/* Student Selector */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="size-5 text-gray-600" />
              <span className="text-sm text-gray-700">Simulate Student:</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((id) => (
                <Button
                  key={id}
                  variant={studentId === id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleGenerate(id)}
                  className={
                    studentId === id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                      : ''
                  }
                >
                  Student {id}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(Math.floor(Math.random() * 1000))}
              className="ml-auto"
            >
              <RefreshCw className="size-4 mr-2" />
              Random Student
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600">Total Questions</p>
              <p className="text-2xl text-gray-800">{generatedQuestions.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Easy</p>
              <p className="text-2xl text-green-600">
                {generatedQuestions.filter((q) => q.difficulty === 'easy').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Medium</p>
              <p className="text-2xl text-amber-600">
                {generatedQuestions.filter((q) => q.difficulty === 'medium').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Hard</p>
              <p className="text-2xl text-red-600">
                {generatedQuestions.filter((q) => q.difficulty === 'hard').length}
              </p>
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {generatedQuestions.map((question, index) => (
              <Card key={`${studentId}-${question.id}`} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs uppercase">
                          {question.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${difficultyColors[question.difficulty]}`}
                        >
                          {question.difficulty}
                        </Badge>
                        {question.hasMultipleCorrect && (
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                            Multi
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 ml-auto">
                          {question.points} pts
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{question.question}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{question.knowledgeDomain}</span>
                        <span>•</span>
                        <span className="text-purple-600">ID: {question.id}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Generated {generatedQuestions.length} unique questions for Student {studentId}
            </p>
            <Button variant="outline" onClick={onClose}>
              Close Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
