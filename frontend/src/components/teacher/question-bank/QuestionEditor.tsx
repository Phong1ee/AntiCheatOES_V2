import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { X, Save, Eye, Plus, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../../ui/alert';
import { Switch } from '../../ui/switch';

interface QuestionEditorProps {
  questionId: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function QuestionEditor({ questionId, onClose, onSave }: QuestionEditorProps) {
  const [questionType, setQuestionType] = useState<string>('mcq');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionText, setQuestionText] = useState('');
  const [tags, setTags] = useState('');
  const [mcqOptions, setMcqOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number[]>([0]); // Support multiple correct answers
  const [allowMultipleCorrect, setAllowMultipleCorrect] = useState(false);
  const [tfAnswer, setTfAnswer] = useState<string>('true');
  const [essayGuideline, setEssayGuideline] = useState('');

  const errors: string[] = [];
  if (!questionText.trim()) errors.push('Question text is required');
  if (!subject) errors.push('Subject is required');
  if (questionType === 'mcq' && mcqOptions.some((opt) => !opt.trim())) {
    errors.push('All answer options must be filled');
  }

  const addMcqOption = () => {
    setMcqOptions([...mcqOptions, '']);
  };

  const removeMcqOption = (index: number) => {
    if (mcqOptions.length > 2) {
      setMcqOptions(mcqOptions.filter((_, i) => i !== index));
      // Remove this index from correct answers and adjust others
      setCorrectAnswer(correctAnswer.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    }
  };

  const updateMcqOption = (index: number, value: string) => {
    const newOptions = [...mcqOptions];
    newOptions[index] = value;
    setMcqOptions(newOptions);
  };

  const handleSave = () => {
    if (errors.length === 0) {
      onSave();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl text-gray-800">
              {questionId ? 'Edit Question' : 'Add New Question'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Fill in the details to create or update a question
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validation Errors */}
          {errors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="size-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* General Information */}
          <Card className="shadow-md rounded-2xl border-0">
            <CardHeader>
              <CardTitle className="text-gray-800">General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Question Type *</Label>
                  <Select value={questionType} onValueChange={setQuestionType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="true-false">True/False</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                      <SelectItem value="matching">Matching</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger
                      id="subject"
                      className={!subject ? 'border-red-300' : ''}
                    >
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database">Database Systems</SelectItem>
                      <SelectItem value="web">Web Development</SelectItem>
                      <SelectItem value="datastructures">Data Structures</SelectItem>
                      <SelectItem value="algorithms">Algorithms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter/Topic</Label>
                  <Input
                    id="chapter"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="e.g., Chapter 3: Database Design"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="difficulty">
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

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Enter tags separated by commas (e.g., normalization, sql)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Question Content */}
          <Card className="shadow-md rounded-2xl border-0">
            <CardHeader>
              <CardTitle className="text-gray-800">Question Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question Text *</Label>
                <Textarea
                  id="question"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Enter your question here..."
                  rows={4}
                  className={`resize-none ${!questionText.trim() ? 'border-red-300' : ''}`}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ImageIcon className="size-4 mr-2" />
                    Add Image
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Answer Options - MCQ */}
          {questionType === 'mcq' && (
            <Card className="shadow-md rounded-2xl border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-800">Answer Options</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="multiple-correct"
                        checked={allowMultipleCorrect}
                        onCheckedChange={(checked) => {
                          setAllowMultipleCorrect(checked);
                          // Reset to single answer if switching to single mode
                          if (!checked && correctAnswer.length > 1) {
                            setCorrectAnswer([correctAnswer[0]]);
                          }
                        }}
                      />
                      <Label htmlFor="multiple-correct" className="text-xs cursor-pointer">
                        Allow Multiple Correct Answers
                      </Label>
                    </div>
                    <Button variant="outline" size="sm" onClick={addMcqOption}>
                      <Plus className="size-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mcqOptions.map((option, index) => {
                  const isChecked = correctAnswer.includes(index);
                  return (
                    <div key={index} className="flex items-center gap-3">
                      {allowMultipleCorrect ? (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setCorrectAnswer(correctAnswer.filter((i) => i !== index));
                            } else {
                              setCorrectAnswer([...correctAnswer, index]);
                            }
                          }}
                          className="size-4 text-teal-600 rounded cursor-pointer"
                        />
                      ) : (
                        <input
                          type="radio"
                          name="correct"
                          checked={isChecked}
                          onChange={() => setCorrectAnswer([index])}
                          className="size-4 text-teal-600 cursor-pointer"
                        />
                      )}
                      <Input
                        value={option}
                        onChange={(e) => updateMcqOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      {mcqOptions.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMcqOption(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-gray-500">
                  {allowMultipleCorrect
                    ? 'Check all correct answers'
                    : 'Select the correct answer by clicking the radio button'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Answer - True/False */}
          {questionType === 'true-false' && (
            <Card className="shadow-md rounded-2xl border-0">
              <CardHeader>
                <CardTitle className="text-gray-800">Correct Answer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tf-answer"
                      checked={tfAnswer === 'true'}
                      onChange={() => setTfAnswer('true')}
                      className="size-4 text-teal-600"
                    />
                    <span className="text-gray-700">True</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tf-answer"
                      checked={tfAnswer === 'false'}
                      onChange={() => setTfAnswer('false')}
                      className="size-4 text-teal-600"
                    />
                    <span className="text-gray-700">False</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Answer - Essay */}
          {questionType === 'essay' && (
            <Card className="shadow-md rounded-2xl border-0">
              <CardHeader>
                <CardTitle className="text-gray-800">Answer Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="guideline">Expected Answer / Grading Rubric</Label>
                  <Textarea
                    id="guideline"
                    value={essayGuideline}
                    onChange={(e) => setEssayGuideline(e.target.value)}
                    placeholder="Enter the expected answer or grading guidelines..."
                    rows={5}
                    className="resize-none"
                  />
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    Essay questions will be manually graded. Provide clear guidelines for grading.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Answer - Matching */}
          {questionType === 'matching' && (
            <Card className="shadow-md rounded-2xl border-0">
              <CardHeader>
                <CardTitle className="text-gray-800">Matching Pairs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    Matching question editor is under development. Please use MCQ or other types for now.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="size-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={errors.length > 0}
              className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
            >
              <Save className="size-4 mr-2" />
              Save Question
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
