import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Hash,
  Filter,
  Shuffle
} from 'lucide-react';

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

interface PoolRule {
  knowledgeDomain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  available: number;
}

interface PoolConfig {
  subject: string;
  rules: PoolRule[];
  totalQuestions: number;
}

interface PoolConfigurationBuilderProps {
  questionBank: Question[];
  onConfigChange: (config: PoolConfig) => void;
  initialConfig?: PoolConfig;
}

export function PoolConfigurationBuilder({
  questionBank,
  onConfigChange,
  initialConfig,
}: PoolConfigurationBuilderProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>(
    initialConfig?.subject || 'all'
  );
  const [rules, setRules] = useState<PoolRule[]>(initialConfig?.rules || []);

  // Get available subjects and knowledge domains
  const subjects = ['all', ...Array.from(new Set(questionBank.map((q) => q.subject)))];
  
  const filteredQuestions = questionBank.filter((q) =>
    selectedSubject === 'all' ? true : q.subject === selectedSubject
  );

  const knowledgeDomains = Array.from(
    new Set(filteredQuestions.map((q) => q.knowledgeDomain))
  ).sort();

  const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];

  // Clear invalid rules when subject changes
  useEffect(() => {
    if (rules.length > 0) {
      const validDomains = new Set(knowledgeDomains);
      const validRules = rules.filter(rule => validDomains.has(rule.knowledgeDomain));
      if (validRules.length !== rules.length) {
        setRules(validRules);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject]);

  // Calculate available questions for each domain + difficulty combination
  const getAvailableCount = (domain: string, difficulty: 'easy' | 'medium' | 'hard') => {
    return filteredQuestions.filter(
      (q) => q.knowledgeDomain === domain && q.difficulty === difficulty
    ).length;
  };

  // Get or create rule for domain + difficulty
  const getRule = (domain: string, difficulty: 'easy' | 'medium' | 'hard'): PoolRule => {
    const existing = rules.find(
      (r) => r.knowledgeDomain === domain && r.difficulty === difficulty
    );
    if (existing) return existing;
    
    return {
      knowledgeDomain: domain,
      difficulty,
      count: 0,
      available: getAvailableCount(domain, difficulty),
    };
  };

  // Update rule count
  const updateRuleCount = (domain: string, difficulty: 'easy' | 'medium' | 'hard', count: number) => {
    const available = getAvailableCount(domain, difficulty);
    const validCount = Math.max(0, Math.min(count, available));

    setRules((prev) => {
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

  // Auto-distribute questions evenly
  const autoDistribute = () => {
    if (knowledgeDomains.length === 0) return;

    // Get total available questions
    const totalAvailable = filteredQuestions.length;
    
    // Calculate target questions per domain
    const questionsPerDomain = Math.floor(totalAvailable / knowledgeDomains.length / 3); // Divided by 3 difficulties
    
    const newRules: PoolRule[] = [];
    
    knowledgeDomains.forEach((domain) => {
      difficulties.forEach((difficulty) => {
        const available = getAvailableCount(domain, difficulty);
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
    
    setRules(newRules);
  };

  // Clear all rules
  const clearAll = () => {
    setRules([]);
  };

  // Calculate totals
  const totalConfigured = rules.reduce((sum, rule) => sum + rule.count, 0);
  const totalAvailable = filteredQuestions.length;

  // Emit config changes
  useEffect(() => {
    onConfigChange({
      subject: selectedSubject,
      rules,
      totalQuestions: totalConfigured,
    });
  }, [selectedSubject, rules, totalConfigured]);

  const difficultyColors = {
    easy: 'text-green-600 bg-green-50 border-green-300',
    medium: 'text-amber-600 bg-amber-50 border-amber-300',
    hard: 'text-red-600 bg-red-50 border-red-300',
  };

  return (
    <div className="space-y-4">
      {/* Subject Filter */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm text-gray-700 mb-2 block">Subject Filter</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
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
                onClick={autoDistribute}
                disabled={knowledgeDomains.length === 0}
              >
                <Shuffle className="size-4 mr-2" />
                Auto Distribute
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={rules.length === 0}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Hash className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Available</p>
                <p className="text-xl text-gray-800">{totalAvailable}</p>
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
                <p className="text-xs text-gray-600">Questions to Draw</p>
                <p className="text-xl text-gray-800">{totalConfigured}</p>
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
                <p className="text-xl text-gray-800">{knowledgeDomains.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Matrix */}
      {knowledgeDomains.length === 0 ? (
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
              Question Distribution Matrix
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Configure how many questions to draw from each knowledge domain and difficulty level.
              Each student will receive different questions based on this configuration.
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
                        className={`px-4 py-3 text-center text-xs ${difficultyColors[diff]}`}
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
                  {knowledgeDomains.map((domain, idx) => {
                    const domainTotal = difficulties.reduce((sum, diff) => {
                      const rule = getRule(domain, diff);
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
                          const rule = getRule(domain, diff);
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
                                    updateRuleCount(
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
                      const total = knowledgeDomains.reduce((sum, domain) => {
                        const rule = getRule(domain, diff);
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
                        {totalConfigured}
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
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-800">
              <strong>Randomization Per Student:</strong> Each student will receive a unique set of questions
              drawn randomly from the question pool based on this configuration. All students will have
              the same number of questions from each knowledge domain and difficulty level, but the
              specific questions will vary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
