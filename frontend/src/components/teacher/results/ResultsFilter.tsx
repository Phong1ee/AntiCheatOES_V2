import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Search, Filter, X } from 'lucide-react';

interface ResultsFilterProps {
  onFilterChange: (filters: any) => void;
}

export function ResultsFilter({ onFilterChange }: ResultsFilterProps) {
  const [examId, setExamId] = useState('');
  const [classGroup, setClassGroup] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const clearFilters = () => {
    setExamId('');
    setClassGroup('all');
    setStatus('all');
    setSearchQuery('');
  };

  const applyFilters = () => {
    onFilterChange({ examId, classGroup, status, searchQuery });
  };

  const hasActiveFilters =
    examId || classGroup !== 'all' || status !== 'all' || searchQuery;

  return (
    <Card className="shadow-md rounded-2xl border-0">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="size-5 text-teal-600" />
          <h3 className="text-gray-800">Filter Results</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Exam Selection */}
          <div className="space-y-2">
            <Label htmlFor="exam">Exam</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger id="exam">
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exam1">Database Midterm Exam</SelectItem>
                <SelectItem value="exam2">Web Development Final</SelectItem>
                <SelectItem value="exam3">Data Structures Quiz</SelectItem>
                <SelectItem value="exam4">Algorithms Assessment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Class/Group */}
          <div className="space-y-2">
            <Label htmlFor="class">Class</Label>
            <Select value={classGroup} onValueChange={setClassGroup}>
              <SelectTrigger id="class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="cs301">CS301-A</SelectItem>
                <SelectItem value="cs302">CS301-B</SelectItem>
                <SelectItem value="cs401">CS401-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="not-submitted">Not Submitted</SelectItem>
                <SelectItem value="late">Late Submission</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name or ID"
                className="pl-10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 flex flex-col justify-end">
            <div className="flex gap-2">
              <Button
                onClick={applyFilters}
                className="flex-1 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700"
              >
                Apply
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} size="icon">
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
