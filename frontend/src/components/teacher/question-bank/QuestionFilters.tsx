import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Filter, X } from 'lucide-react';
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionBankFilters,
  QuestionBankTab,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
} from '../../../types/question-bank';

interface QuestionFiltersProps {
  activeTab: QuestionBankTab;
  filters: QuestionBankFilters;
  chapters: ChapterSummary[];
  learningObjectives: LearningObjectiveSummary[];
  onFilterChange: (filters: QuestionBankFilters) => void;
}

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'essay', label: 'Essay' },
];

const difficulties: Array<{ value: QuestionDifficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const statuses: Array<{ value: QuestionStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function QuestionFilters({
  activeTab,
  filters,
  chapters,
  learningObjectives,
  onFilterChange,
}: QuestionFiltersProps) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const update = (patch: Partial<QuestionBankFilters>) => {
    onFilterChange({ ...filters, ...patch });
  };

  const clearAllFilters = () => {
    onFilterChange({});
  };

  return (
    <div className="h-full bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-teal-600" />
            <h3 className="text-gray-800">Filters</h3>
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="bg-teal-100 text-teal-700">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="size-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'mine' && (
          <Card className="rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={filters.status ?? 'all'} onValueChange={(value) => update({ status: value === 'all' ? undefined : (value as QuestionStatus) })}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={filters.question_type ?? 'all'} onValueChange={(value) => update({ question_type: value === 'all' ? undefined : (value as QuestionType) })}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {questionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={filters.difficulty ?? 'all'} onValueChange={(value) => update({ difficulty: value === 'all' ? undefined : (value as QuestionDifficulty) })}>
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {difficulties.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxonomy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Chapter</Label>
              <Select
                value={filters.chapter_id ? String(filters.chapter_id) : 'all'}
                onValueChange={(value) => update({ chapter_id: value === 'all' ? undefined : Number(value), lo_id: undefined })}
                disabled={chapters.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All chapters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.chapter_id} value={String(chapter.chapter_id)}>
                      {chapter.chapter_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Learning Objective</Label>
              <Select
                value={filters.lo_id ? String(filters.lo_id) : 'all'}
                onValueChange={(value) => update({ lo_id: value === 'all' ? undefined : Number(value) })}
                disabled={learningObjectives.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All objectives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Objectives</SelectItem>
                  {learningObjectives.map((lo) => (
                    <SelectItem key={lo.lo_id} value={String(lo.lo_id)}>
                      {lo.lo_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
