import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader } from '../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import {
  X,
  Shuffle,
  Plus,
  Settings2,
  Info,
  CheckCircle2,
  AlertCircle,
  Filter,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { PoolConfigurationBuilder } from './PoolConfigurationBuilder';

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

interface RandomizeRule {
  knowledgeDomain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  available: number;
}

interface QuestionPoolModalProps {
  onClose: () => void;
  onAddQuestions: (questions: Question[]) => void;
  onAddPoolConfig?: (config: PoolConfig) => void;
}

// Mock question bank data
const mockQuestionBank: Question[] = [
  {
    id: 'q1',
    type: 'mcq',
    question: 'What is normalization in database design?',
    subject: 'Database Systems',
    knowledgeDomain: 'Database Design',
    difficulty: 'medium',
    points: 5,
    options: [
      'Process of organizing data to reduce redundancy',
      'Process of creating backups',
      'Process of encrypting data',
      'Process of indexing tables',
    ],
    correctAnswer: 0,
    hasMultipleCorrect: false,
  },
  {
    id: 'q2',
    type: 'mcq',
    question: 'Which of the following are valid SQL aggregate functions?',
    subject: 'Database Systems',
    knowledgeDomain: 'SQL Queries',
    difficulty: 'easy',
    points: 4,
    options: ['COUNT()', 'SUM()', 'AVG()', 'CONCAT()'],
    correctAnswer: [0, 1, 2],
    hasMultipleCorrect: true,
  },
  {
    id: 'q3',
    type: 'mcq',
    question: 'Which normal form removes transitive dependencies?',
    subject: 'Database Systems',
    knowledgeDomain: 'Normalization',
    difficulty: 'hard',
    points: 6,
    options: ['1NF', '2NF', '3NF', 'BCNF'],
    correctAnswer: 2,
    hasMultipleCorrect: false,
  },
  {
    id: 'q4',
    type: 'essay',
    question: 'Explain the ACID properties in database transactions.',
    subject: 'Database Systems',
    knowledgeDomain: 'Transactions',
    difficulty: 'hard',
    points: 10,
  },
  {
    id: 'q5',
    type: 'true-false',
    question: 'A foreign key can contain NULL values.',
    subject: 'Database Systems',
    knowledgeDomain: 'Database Design',
    difficulty: 'medium',
    points: 3,
    correctAnswer: 'true',
  },
  {
    id: 'q6',
    type: 'mcq',
    question: 'What is the time complexity of binary search?',
    subject: 'Data Structures',
    knowledgeDomain: 'Search Algorithms',
    difficulty: 'easy',
    points: 4,
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
    correctAnswer: 1,
    hasMultipleCorrect: false,
  },
  {
    id: 'q7',
    type: 'mcq',
    question: 'Which data structures use LIFO principle?',
    subject: 'Data Structures',
    knowledgeDomain: 'Linear Structures',
    difficulty: 'easy',
    points: 3,
    options: ['Stack', 'Deque (when used as stack)', 'Queue', 'Tree'],
    correctAnswer: [0, 1],
    hasMultipleCorrect: true,
  },
  {
    id: 'q8',
    type: 'mcq',
    question: 'What is the worst-case time complexity of QuickSort?',
    subject: 'Algorithms',
    knowledgeDomain: 'Sorting',
    difficulty: 'medium',
    points: 5,
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
    correctAnswer: 2,
    hasMultipleCorrect: false,
  },
];

export function QuestionPoolModal({ onClose, onAddQuestions, onAddPoolConfig }: QuestionPoolModalProps) {
  const [mode, setMode] = useState<'manual' | 'randomize' | 'pool-config'>('manual');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedKnowledgeDomain, setSelectedKnowledgeDomain] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  
  // Fixed Randomization settings - now with domain + difficulty matrix
  const [randomSubject, setRandomSubject] = useState<string>('all');
  const [randomRules, setRandomRules] = useState<RandomizeRule[]>([]);
  
  // Pool configuration
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null);

  // Get available subjects
  const subjects = ['all', ...Array.from(new Set(mockQuestionBank.map((q) => q.subject)))];
  
  // For manual mode - knowledge domains based on selected subject
  const knowledgeDomains = selectedSubject === 'all'
    ? ['all', ...Array.from(new Set(mockQuestionBank.map((q) => q.knowledgeDomain)))]
    : [
        'all',
        ...Array.from(
          new Set(
            mockQuestionBank
              .filter((q) => q.subject === selectedSubject)
              .map((q) => q.knowledgeDomain)
          )
        ),
      ];

  // For randomize mode - get filtered questions and domains
  const randomFilteredQuestions = mockQuestionBank.filter((q) =>
    randomSubject === 'all' ? true : q.subject === randomSubject
  );

  const randomKnowledgeDomains = Array.from(
    new Set(randomFilteredQuestions.map((q) => q.knowledgeDomain))
  ).sort();

  const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

  // Get available count for randomize mode
  const getRandomAvailableCount = (domain: string, difficulty: 'easy' | 'medium' | 'hard') => {
    return randomFilteredQuestions.filter(
      (q) => q.knowledgeDomain === domain && q.difficulty === difficulty
    ).length;
  };

  // Get or create rule for randomize mode
  const getRandomRule = (domain: string, difficulty: 'easy' | 'medium' | 'hard'): RandomizeRule => {
    const existing = randomRules.find(
      (r) => r.knowledgeDomain === domain && r.difficulty === difficulty
    );
    if (existing) return existing;
    
    return {
      knowledgeDomain: domain,
      difficulty,
      count: 0,
      available: getRandomAvailableCount(domain, difficulty),
    };
  };

  // Update rule count for randomize mode
  const updateRandomRuleCount = (domain: string, difficulty: 'easy' | 'medium' | 'hard', count: number) => {
    const available = getRandomAvailableCount(domain, difficulty);
    const validCount = Math.max(0, Math.min(count, available));

    setRandomRules((prev) => {
      const filtered = prev.filter(
        (r) => !(r.knowledgeDomain === domain && r.difficulty === difficulty)
      );
      
      if (validCount > 0) {
        return [
          ...filtered,
          {
            knowledgeDomain: domain,
            difficulty,
            count: validCount,
            available,
          },
        ];
      }
      return filtered;
    });
  };

  // Auto-distribute for randomize mode
  const autoDistributeRandom = () => {
    if (randomKnowledgeDomains.length === 0) return;

    const totalAvailable = randomFilteredQuestions.length;
    const questionsPerDomain = Math.floor(totalAvailable / randomKnowledgeDomains.length / 3);
    
    const newRules: RandomizeRule[] = [];
    
    randomKnowledgeDomains.forEach((domain) => {
      difficulties.forEach((difficulty) => {
        const available = getRandomAvailableCount(domain, difficulty);
        const count = Math.min(questionsPerDomain, available);
        
        if (count > 0) {
          newRules.push({
            knowledgeDomain: domain,
            difficulty,
            count,
            available,
          });
        }
      });
    });
    
    setRandomRules(newRules);
  };

  // Clear all rules for randomize mode
  const clearRandomRules = () => {
    setRandomRules([]);
  };

  // Calculate totals for randomize mode
  const totalRandomConfigured = randomRules.reduce((sum, rule) => sum + rule.count, 0);

  // Filter questions based on criteria (for manual mode)
  const filteredQuestions = mockQuestionBank.filter((q) => {
    if (selectedSubject !== 'all' && q.subject !== selectedSubject) return false;
    if (selectedKnowledgeDomain !== 'all' && q.knowledgeDomain !== selectedKnowledgeDomain)
      return false;
    if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((qid) => qid !== id) : [...prev, id]
    );
  };

  const randomizeQuestions = () => {
    if (randomRules.length === 0) {
      toast.error('Please configure at least one question selection rule');
      return [];
    }

    const selectedQuestions: Question[] = [];

    // For each rule, randomly select questions
    randomRules.forEach((rule) => {
      const availableQuestions = randomFilteredQuestions.filter(
        (q) => q.knowledgeDomain === rule.knowledgeDomain && q.difficulty === rule.difficulty
      );
      
      // Shuffle and select the required count
      const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
      selectedQuestions.push(...shuffled.slice(0, rule.count));
    });

    return selectedQuestions;
  };

  const handleAddQuestions = () => {
    let questionsToAdd: Question[] = [];

    if (mode === 'manual') {
      questionsToAdd = mockQuestionBank.filter((q) => selectedQuestionIds.includes(q.id));
      if (questionsToAdd.length === 0) {
        toast.error('Please select at least one question');
        return;
      }
      onAddQuestions(questionsToAdd);
      toast.success(`${questionsToAdd.length} question(s) added from question pool`);
    } else if (mode === 'randomize') {
      questionsToAdd = randomizeQuestions();
      if (questionsToAdd.length === 0) {
        return; // Error already shown
      }
      onAddQuestions(questionsToAdd);
      toast.success(`${questionsToAdd.length} question(s) randomly selected and added`);
    } else if (mode === 'pool-config') {
      if (!poolConfig || poolConfig.totalQuestions === 0) {
        toast.error('Please configure at least one question in the pool');
        return;
      }
      if (onAddPoolConfig) {
        onAddPoolConfig(poolConfig);
        toast.success(`Question pool configured: ${poolConfig.totalQuestions} questions will be randomized per student`);
      }
    }

    onClose();
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-amber-100 text-amber-700 border-amber-300',
    hard: 'bg-red-100 text-red-700 border-red-300',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-500 to-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl text-white">Import from Question Bank</h2>
              <p className="text-sm text-white/90 mt-1">
                Select questions manually, randomize fixed set, or configure per-student randomization
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <Button
              variant={mode === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('manual')}
              className={
                mode === 'manual'
                  ? 'bg-gradient-to-r from-teal-500 to-blue-600'
                  : ''
              }
            >
              <Plus className="size-4 mr-2" />
              Manual Selection
            </Button>
            <Button
              variant={mode === 'randomize' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('randomize')}
              className={
                mode === 'randomize'
                  ? 'bg-gradient-to-r from-teal-500 to-blue-600'
                  : ''
              }
            >
              <Shuffle className="size-4 mr-2" />
              Fixed Randomization
            </Button>
            <Button
              variant={mode === 'pool-config' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('pool-config')}
              className={
                mode === 'pool-config'
                  ? 'bg-gradient-to-r from-teal-500 to-blue-600'
                  : ''
              }
            >
              <Settings2 className="size-4 mr-2" />
              Pool Configuration
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Filters (hide for pool-config mode) */}
          {mode !== 'pool-config' && mode === 'manual' && (
          <div className="w-80 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <Settings2 className="size-4" />
                  Filter Criteria
                </h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Subject</Label>
                    <Select value={selectedSubject} onValueChange={(value) => {
                      setSelectedSubject(value);
                      setSelectedKnowledgeDomain('all');
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject === 'all' ? 'All Subjects' : subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Knowledge Domain</Label>
                    <Select
                      value={selectedKnowledgeDomain}
                      onValueChange={setSelectedKnowledgeDomain}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {knowledgeDomains.map((domain) => (
                          <SelectItem key={domain} value={domain}>
                            {domain === 'all' ? 'All Domains' : domain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Difficulty</Label>
                    <Select
                      value={selectedDifficulty}
                      onValueChange={setSelectedDifficulty}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Difficulties</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Right Panel - Question List or Configuration */}
          <div className="flex-1 overflow-y-auto p-6">
            {mode === 'pool-config' ? (
              <PoolConfigurationBuilder
                questionBank={mockQuestionBank}
                onConfigChange={setPoolConfig}
              />
            ) : mode === 'randomize' ? (
              /* Fixed Randomization Matrix */
              <div className="space-y-4">
                {/* Subject Filter */}
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-sm text-gray-700 mb-2 block">Subject Filter</Label>
                        <Select value={randomSubject} onValueChange={(value) => {
                          setRandomSubject(value);
                          setRandomRules([]);
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map((subject) => (
                              <SelectItem key={subject} value={subject}>
                                {subject === 'all' ? 'All Subjects' : subject}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={autoDistributeRandom}
                          disabled={randomKnowledgeDomains.length === 0}
                        >
                          <Shuffle className="size-4 mr-2" />
                          Auto Distribute
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearRandomRules}
                          disabled={randomRules.length === 0}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Hash className="size-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Total Available</p>
                          <p className="text-xl text-gray-800">{randomFilteredQuestions.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-l-4 border-l-teal-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg">
                          <CheckCircle2 className="size-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Questions to Select</p>
                          <p className="text-xl text-gray-800">{totalRandomConfigured}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Filter className="size-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Knowledge Domains</p>
                          <p className="text-xl text-gray-800">{randomKnowledgeDomains.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Configuration Matrix */}
                {randomKnowledgeDomains.length === 0 ? (
                  <Card className="shadow-sm">
                    <CardContent className="p-12 text-center">
                      <AlertCircle className="size-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No questions available in question bank</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Please add questions to the question bank first
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-sm">
                    <CardHeader className="border-b border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm text-gray-700 flex items-center gap-2">
                        <Filter className="size-4" />
                        Question Selection Matrix
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Configure how many questions to randomly select from each knowledge domain and difficulty level.
                        These questions will be fixed for all students in this exam.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs text-gray-700">
                                Knowledge Domain
                              </th>
                              {difficulties.map((diff) => (
                                <th
                                  key={diff}
                                  className={`px-4 py-3 text-center text-xs ${
                                    diff === 'easy'
                                      ? 'text-green-600 bg-green-50'
                                      : diff === 'medium'
                                      ? 'text-amber-600 bg-amber-50'
                                      : 'text-red-600 bg-red-50'
                                  }`}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="capitalize">{diff}</span>
                                  </div>
                                </th>
                              ))}
                              <th className="px-4 py-3 text-center text-xs text-gray-700 bg-gray-100">
                                Subtotal
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {randomKnowledgeDomains.map((domain, idx) => {
                              const domainTotal = difficulties.reduce((sum, diff) => {
                                const rule = getRandomRule(domain, diff);
                                return sum + rule.count;
                              }, 0);

                              return (
                                <tr
                                  key={domain}
                                  className={`border-b border-gray-200 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  }`}
                                >
                                  <td className="px-4 py-3 text-sm text-gray-800">{domain}</td>
                                  {difficulties.map((diff) => {
                                    const rule = getRandomRule(domain, diff);
                                    const hasError = rule.count > rule.available;

                                    return (
                                      <td key={diff} className="px-4 py-3">
                                        <div className="flex flex-col items-center gap-1">
                                          <Input
                                            type="number"
                                            min="0"
                                            max={rule.available}
                                            value={rule.count || ''}
                                            onChange={(e) =>
                                              updateRandomRuleCount(
                                                domain,
                                                diff,
                                                parseInt(e.target.value) || 0
                                              )
                                            }
                                            className={`w-20 text-center ${
                                              hasError ? 'border-red-500' : ''
                                            }`}
                                            placeholder="0"
                                          />
                                          <span className="text-xs text-gray-500">
                                            of {rule.available}
                                          </span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-3 text-center bg-gray-100">
                                    <Badge variant="outline" className="bg-white">
                                      {domainTotal}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-100 border-t-2 border-gray-300">
                              <td className="px-4 py-3 text-sm text-gray-800">
                                <strong>Total</strong>
                              </td>
                              {difficulties.map((diff) => {
                                const total = randomKnowledgeDomains.reduce((sum, domain) => {
                                  const rule = getRandomRule(domain, diff);
                                  return sum + rule.count;
                                }, 0);

                                return (
                                  <td key={diff} className="px-4 py-3 text-center">
                                    <Badge variant="outline" className="bg-white">
                                      {total}
                                    </Badge>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center">
                                <Badge className="bg-gradient-to-r from-teal-500 to-blue-600 text-white">
                                  {totalRandomConfigured}
                                </Badge>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Important Notice */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Info className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800">
                        <strong>Fixed Randomization:</strong> Questions will be randomly selected based on this
                        configuration when you click "Add Questions". All students will receive the same set of questions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Manual Selection Mode */
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''} available
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedQuestionIds.length} selected
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <AlertCircle className="size-12 text-gray-300 mx-auto mb-3" />
                      <p>No questions match the current filters</p>
                      <p className="text-sm mt-2">Try adjusting your filter criteria</p>
                    </div>
                  ) : (
                    filteredQuestions.map((question) => {
                      const isSelected = selectedQuestionIds.includes(question.id);
                      return (
                        <Card
                          key={question.id}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? 'border-teal-500 border-2 shadow-md bg-teal-50'
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => toggleQuestionSelection(question.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                className="mt-1"
                                onCheckedChange={() => toggleQuestionSelection(question.id)}
                              />
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
                                      Multiple Answers
                                    </Badge>
                                  )}
                                  <span className="text-xs text-gray-500 ml-auto">
                                    {question.points} pts
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{question.question}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{question.subject}</span>
                                  <span>•</span>
                                  <span>{question.knowledgeDomain}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddQuestions}
            className="bg-gradient-to-r from-teal-500 to-blue-600"
            disabled={
              (mode === 'manual' && selectedQuestionIds.length === 0) ||
              (mode === 'randomize' && totalRandomConfigured === 0) ||
              (mode === 'pool-config' && (!poolConfig || poolConfig.totalQuestions === 0))
            }
          >
            <CheckCircle2 className="size-4 mr-2" />
            {mode === 'pool-config' 
              ? `Configure Pool (${poolConfig?.totalQuestions || 0} questions)`
              : mode === 'randomize'
              ? `Add ${totalRandomConfigured} Question${totalRandomConfigured !== 1 ? 's' : ''}`
              : `Add ${selectedQuestionIds.length} Question${selectedQuestionIds.length !== 1 ? 's' : ''}`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
