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
    <div className="qb-ref-filters">
      <div className="qb-ref-filter-group">
        <span className="qb-ref-filter-label">Type</span>
        {typeOptions.map((option) => {
          const active = filters.question_type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`qb-ref-filter-pill type${active ? ' is-active' : ''}`}
              onClick={() => update({ question_type: active ? undefined : option.value })}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <span className="qb-ref-filter-divider" aria-hidden="true" />

      <div className="qb-ref-filter-group">
        <span className="qb-ref-filter-label">Level</span>
        {difficultyOptions.map((option) => {
          const active = filters.difficulty === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`qb-ref-filter-pill ${option.value}${active ? ' is-active' : ''}`}
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
          className="qb-ref-filter-clear"
          onClick={() => update({ question_type: undefined, difficulty: undefined })}
        >
          <X />
          Clear ({activeQuestionFilterCount})
        </button>
      )}

      {showTaxonomy && (
        <div className="qb-ref-taxonomy-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`qb-ref-taxonomy-trigger${taxonomyActive ? ' is-active' : ''}`}
              >
                <Filter />
                Taxonomy
                <ChevronDown />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="qb-ref-taxonomy-panel">
              <div className="qb-ref-taxonomy-head">
                <span className="qb-ref-taxonomy-title">Taxonomy</span>
                {taxonomyActive && (
                  <button
                    type="button"
                    className="qb-ref-filter-clear"
                    onClick={() => update({ chapter_id: undefined, lo_id: undefined })}
                  >
                    <X /> Clear
                  </button>
                )}
              </div>

              <div className="qb-ref-taxonomy-fields">
                <div className="qb-ref-taxonomy-field">
                  <label>Chapter</label>
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

                <div className="qb-ref-taxonomy-field">
                  <label>Learning Objective</label>
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