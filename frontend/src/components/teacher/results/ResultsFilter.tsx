import { useEffect, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Search, X } from 'lucide-react';

export interface ResultsFilterValue {
  search: string;
  status: string;
}

interface ResultsFilterProps {
  onFilterChange: (filters: ResultsFilterValue) => void;
}

export function ResultsFilter({ onFilterChange }: ResultsFilterProps) {
  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    onFilterChange({ search: searchQuery, status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, status]);

  const clearFilters = () => {
    setStatus('all');
    setSearchQuery('');
  };

  const hasActiveFilters = status !== 'all' || searchQuery;

  return (
    <Card className="shadow-md rounded-2xl border-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or ID..."
              className="pl-10"
            />
          </div>

          {/* Status */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="not-submitted">Not Submitted</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear */}
          {hasActiveFilters && (
            <Button variant="outline" size="icon" onClick={clearFilters}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
