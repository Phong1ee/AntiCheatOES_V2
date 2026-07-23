import { useMemo } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type {
  ChapterSummary,
  LearningObjectiveSummary,
  QuestionBankFilters,
  QuestionDifficulty,
  QuestionType,
} from '../../../types/question-bank';

interface QuestionFiltersProps {
  selectedSubject: string;
  filters: QuestionBankFilters;
  chapters: ChapterSummary[];
  learningObjectives: LearningObjectiveSummary[];
  onFilterChange: (filters: QuestionBankFilters) => void;
}

const typeOptions: Array<{ value: QuestionType; label: string }> = [
  { value: 'MCQ', label: 'MCQ' },
  { value: 'true-false', label: 'True/False' },
  { value: 'essay', label: 'Essay' },
];

const difficultyOptions: Array<{ value: QuestionDifficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const difficultyPillClasses: Record<QuestionDifficulty, string> = {
  easy: 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700',
  medium: 'border-amber-200 bg-amber-100 text-amber-700 hover:border-amber-200 hover:bg-amber-100 hover:text-amber-700',
  hard: 'border-red-200 bg-red-100 text-red-700 hover:border-red-200 hover:bg-red-100 hover:text-red-700',
};

const difficultyInactiveClasses: Record<QuestionDifficulty, string> = {
  easy: 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600',
  medium: 'border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600',
  hard: 'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600',
};

export function QuestionFilters({
  selectedSubject,
  filters,
  chapters,
  learningObjectives,
  onFilterChange,
}: QuestionFiltersProps) {
  const showTaxonomy = selectedSubject !== 'all' && selectedSubject !== '__none__';
  const taxonomyActive = Boolean(filters.chapter_id || filters.lo_id);
  const activeQuestionFilterCount = useMemo(
    () => [filters.question_type, filters.difficulty].filter(Boolean).length,
    [filters.question_type, filters.difficulty],
  );

  const update = (patch: Partial<QuestionBankFilters>) => {
    onFilterChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-1 flex-wrap items-center gap-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Type</span>
        {typeOptions.map((option) => {
          const active = filters.question_type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`min-h-[26px] rounded-full border px-3 py-1 font-[inherit] text-xs font-medium leading-4 transition-colors ${
                active
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600'
              }`}
              onClick={() => update({ question_type: active ? undefined : option.value })}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <span className="h-5 w-px bg-gray-200 max-md:hidden" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Level</span>
        {difficultyOptions.map((option) => {
          const active = filters.difficulty === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`min-h-[26px] rounded-full border px-3 py-1 font-[inherit] text-xs font-medium leading-4 transition-colors ${
                active ? difficultyPillClasses[option.value] : difficultyInactiveClasses[option.value]
              }`}
              onClick={() => update({ difficulty: active ? undefined : option.value })}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {activeQuestionFilterCount > 0 && (
        <button
          type="button"
          className="inline-flex items-center gap-1 border-0 bg-transparent p-1 font-[inherit] text-xs text-gray-400 transition-colors hover:text-gray-600 [&_svg]:size-3"
          onClick={() => update({ question_type: undefined, difficulty: undefined })}
        >
          <X />
          Clear ({activeQuestionFilterCount})
        </button>
      )}

      {showTaxonomy && (
        <div className="relative">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 font-[inherit] text-xs font-medium [&_svg]:size-3.5 ${
                  taxonomyActive
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                <Filter />
                Taxonomy
                <ChevronDown />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-32px)] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_10px_25px_rgb(15_23_42_/_0.12)]">
              <div className="mb-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Taxonomy</span>
                {taxonomyActive && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 border-0 bg-transparent p-1 font-[inherit] text-xs text-gray-400 transition-colors hover:text-gray-600 [&_svg]:size-3"
                    onClick={() => update({ chapter_id: undefined, lo_id: undefined })}
                  >
                    <X /> Clear
                  </button>
                )}
              </div>

              <div className="grid gap-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Chapter</label>
                  <Select
                    value={filters.chapter_id ? String(filters.chapter_id) : 'all'}
                    onValueChange={(value) =>
                      update({
                        chapter_id: value === 'all' ? undefined : Number(value),
                        lo_id: undefined,
                      })
                    }
                    disabled={chapters.length === 0}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-gray-50 text-sm shadow-none">
                      <SelectValue placeholder="All Chapters" />
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

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Learning Objective</label>
                  <Select
                    value={filters.lo_id ? String(filters.lo_id) : 'all'}
                    onValueChange={(value) => update({ lo_id: value === 'all' ? undefined : Number(value) })}
                    disabled={!filters.chapter_id || learningObjectives.length === 0}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-gray-50 text-sm shadow-none">
                      <SelectValue placeholder="All Objectives" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Objectives</SelectItem>
                      {learningObjectives.map((objective) => (
                        <SelectItem key={objective.lo_id} value={String(objective.lo_id)}>
                          {objective.lo_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
