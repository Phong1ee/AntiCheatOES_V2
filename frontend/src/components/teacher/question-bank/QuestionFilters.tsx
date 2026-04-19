import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../ui/collapsible';
import { Badge } from '../../ui/badge';
import { Filter, X, ChevronDown, ChevronRight } from 'lucide-react';

interface QuestionFiltersProps {
  onFilterChange: (filters: any) => void;
  selectedSubject: string;
}

export function QuestionFilters({ onFilterChange, selectedSubject }: QuestionFiltersProps) {
  const [subject, setSubject] = useState(selectedSubject);
  const [questionTypes, setQuestionTypes] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    type: true,
    difficulty: true,
    tags: true,
    source: false,
  });

  const toggleQuestionType = (type: string) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleDifficulty = (level: string) => {
    setDifficulty((prev) =>
      prev.includes(level) ? prev.filter((d) => d !== level) : [...prev, level]
    );
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleSource = (src: string) => {
    setSource((prev) => (prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]));
  };

  const clearAllFilters = () => {
    setSubject('all');
    setQuestionTypes([]);
    setDifficulty([]);
    setTags([]);
    setSource([]);
  };

  const applyFilters = () => {
    onFilterChange({ subject, questionTypes, difficulty, tags, source });
  };

  const activeFilterCount =
    (subject !== 'all' ? 1 : 0) +
    questionTypes.length +
    difficulty.length +
    tags.length +
    source.length;

  return (
    <div className="h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between mb-4">
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
        {/* Subject */}
        <div className="space-y-2">
          <Label>Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="database">Database Systems</SelectItem>
              <SelectItem value="web">Web Development</SelectItem>
              <SelectItem value="datastructures">Data Structures</SelectItem>
              <SelectItem value="algorithms">Algorithms</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Question Type */}
        <Collapsible
          open={expandedSections.type}
          onOpenChange={(open) => setExpandedSections({ ...expandedSections, type: open })}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <Label className="cursor-pointer">Question Type</Label>
            {expandedSections.type ? (
              <ChevronDown className="size-4 text-gray-500" />
            ) : (
              <ChevronRight className="size-4 text-gray-500" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {[
              { id: 'mcq', label: 'Multiple Choice' },
              { id: 'true-false', label: 'True/False' },
              { id: 'essay', label: 'Essay' },
              { id: 'matching', label: 'Matching' },
            ].map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <Checkbox
                  id={type.id}
                  checked={questionTypes.includes(type.id)}
                  onCheckedChange={() => toggleQuestionType(type.id)}
                />
                <Label htmlFor={type.id} className="text-sm cursor-pointer">
                  {type.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Difficulty */}
        <Collapsible
          open={expandedSections.difficulty}
          onOpenChange={(open) => setExpandedSections({ ...expandedSections, difficulty: open })}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <Label className="cursor-pointer">Difficulty</Label>
            {expandedSections.difficulty ? (
              <ChevronDown className="size-4 text-gray-500" />
            ) : (
              <ChevronRight className="size-4 text-gray-500" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {[
              { id: 'easy', label: 'Easy', color: 'text-green-600' },
              { id: 'medium', label: 'Medium', color: 'text-amber-600' },
              { id: 'hard', label: 'Hard', color: 'text-red-600' },
            ].map((level) => (
              <div key={level.id} className="flex items-center gap-2">
                <Checkbox
                  id={level.id}
                  checked={difficulty.includes(level.id)}
                  onCheckedChange={() => toggleDifficulty(level.id)}
                />
                <Label htmlFor={level.id} className={`text-sm cursor-pointer ${level.color}`}>
                  {level.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Tags */}
        <Collapsible
          open={expandedSections.tags}
          onOpenChange={(open) => setExpandedSections({ ...expandedSections, tags: open })}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <Label className="cursor-pointer">Tags</Label>
            {expandedSections.tags ? (
              <ChevronDown className="size-4 text-gray-500" />
            ) : (
              <ChevronRight className="size-4 text-gray-500" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {[
              { id: 'normalization', label: 'Normalization' },
              { id: 'sql', label: 'SQL' },
              { id: 'indexing', label: 'Indexing' },
              { id: 'transactions', label: 'Transactions' },
            ].map((tag) => (
              <div key={tag.id} className="flex items-center gap-2">
                <Checkbox
                  id={tag.id}
                  checked={tags.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <Label htmlFor={tag.id} className="text-sm cursor-pointer">
                  {tag.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Source */}
        <Collapsible
          open={expandedSections.source}
          onOpenChange={(open) => setExpandedSections({ ...expandedSections, source: open })}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <Label className="cursor-pointer">Source</Label>
            {expandedSections.source ? (
              <ChevronDown className="size-4 text-gray-500" />
            ) : (
              <ChevronRight className="size-4 text-gray-500" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {[
              { id: 'created', label: 'Created by me' },
              { id: 'imported', label: 'Imported' },
              { id: 'shared', label: 'Shared' },
            ].map((src) => (
              <div key={src.id} className="flex items-center gap-2">
                <Checkbox
                  id={src.id}
                  checked={source.includes(src.id)}
                  onCheckedChange={() => toggleSource(src.id)}
                />
                <Label htmlFor={src.id} className="text-sm cursor-pointer">
                  {src.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Apply Button */}
        <Button
          onClick={applyFilters}
          className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}