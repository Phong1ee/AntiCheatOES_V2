import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { BookOpen, ChevronRight, Layers } from 'lucide-react';
import type { QuestionBankTab, SubjectCount } from '../../../types/question-bank';

interface SubjectSidebarProps {
  activeTab: QuestionBankTab;
  selectedSubject: string;
  subjects: SubjectCount[];
  totalCount: number;
  noSubjectCount: number;
  loading: boolean;
  onSubjectSelect: (subjectId: string) => void;
}

export function SubjectSidebar({
  activeTab,
  selectedSubject,
  subjects,
  totalCount,
  noSubjectCount,
  loading,
  onSubjectSelect,
}: SubjectSidebarProps) {
  const items = [
    { id: 'all', name: 'All Subjects', count: totalCount, description: 'Every subject' },
    ...(activeTab === 'mine'
      ? [{ id: '__none__', name: 'No Subject', count: noSubjectCount, description: 'Drafts without a subject' }]
      : []),
    ...subjects.map((subject) => ({
      id: subject.subject_id,
      name: subject.subject_name,
      count: subject.question_count,
      description: subject.subject_id,
    })),
  ];

  return (
    <div className="h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-teal-600" />
          <h3 className="text-gray-800">Subjects</h3>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading &&
          items.map((subject) => (
            <Card
              key={subject.id}
              onClick={() => onSubjectSelect(subject.id)}
              className={`cursor-pointer rounded-lg transition-all hover:shadow-sm ${
                selectedSubject === subject.id ? 'ring-2 ring-teal-500 shadow-sm' : 'hover:ring-1 hover:ring-gray-300'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Layers className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${selectedSubject === subject.id ? 'text-teal-700 font-medium' : 'text-gray-800'}`}>
                      {subject.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{subject.description}</p>
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${
                        selectedSubject === subject.id ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {subject.count} question{subject.count === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  {selectedSubject === subject.id && <ChevronRight className="size-5 text-teal-600 flex-shrink-0" />}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
