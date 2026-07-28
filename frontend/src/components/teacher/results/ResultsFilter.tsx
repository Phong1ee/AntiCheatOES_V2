import { useEffect, useState } from 'react';
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
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="size-5 text-teal-600" />
          <h3 className="text-gray-800">Filter Student Results</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Clear */}
          {hasActiveFilters && (
            <div className="space-y-2 flex flex-col justify-end">
              <Button variant="outline" onClick={clearFilters}>
                <X className="size-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
