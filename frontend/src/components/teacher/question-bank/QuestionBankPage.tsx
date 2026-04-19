import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { SubjectSidebar } from './SubjectSidebar';
import { QuestionFilters } from './QuestionFilters';
import { QuestionList } from './QuestionList';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function QuestionBankPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [filters, setFilters] = useState<any>({});
  const { isAdmin, isTeacher } = useUserRole();

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Info Banner - Only for teachers */}
        {isTeacher && (
          <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-800">
              📚 <strong>View Only Mode:</strong> You can browse and view questions from the central question bank. Contact your administrator to add, edit, or delete questions.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Left: Title */}
          <div>
            <h1 className="text-2xl text-gray-800">Question Bank</h1>
            <p className="text-sm text-gray-600 mt-1">
              Browse and view questions from the central question library
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-teal-50 border-teal-300' : ''}
            >
              <SlidersHorizontal className="size-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Subjects */}
        <div className="w-72">
          <SubjectSidebar
            selectedSubject={selectedSubject}
            onSubjectSelect={setSelectedSubject}
          />
        </div>

        {/* Center - Question List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <QuestionList
              selectedSubject={selectedSubject}
              searchQuery={searchQuery}
              filters={filters}
              readOnly={isTeacher}
            />
          </div>
        </div>

        {/* Right Sidebar - Filters (Toggle) */}
        {showFilters && (
          <div className="w-80">
            <QuestionFilters
              onFilterChange={handleFilterChange}
              selectedSubject={selectedSubject}
            />
          </div>
        )}
      </div>


    </div>
  );
}