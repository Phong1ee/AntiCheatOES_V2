import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { BookOpen, ChevronRight } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  questionCount: number;
  color: string;
}

const subjects: Subject[] = [
  {
    id: 'all',
    name: 'All Subjects',
    questionCount: 245,
    color: 'bg-gradient-to-r from-teal-500 to-blue-600',
  },
  {
    id: 'database',
    name: 'Database Systems',
    questionCount: 87,
    color: 'bg-gradient-to-r from-blue-500 to-indigo-600',
  },
  {
    id: 'web',
    name: 'Web Development',
    questionCount: 65,
    color: 'bg-gradient-to-r from-purple-500 to-pink-600',
  },
  {
    id: 'datastructures',
    name: 'Data Structures',
    questionCount: 52,
    color: 'bg-gradient-to-r from-green-500 to-teal-600',
  },
  {
    id: 'algorithms',
    name: 'Algorithms',
    questionCount: 41,
    color: 'bg-gradient-to-r from-amber-500 to-orange-600',
  },
];

interface SubjectSidebarProps {
  selectedSubject: string;
  onSubjectSelect: (subjectId: string) => void;
}

export function SubjectSidebar({ selectedSubject, onSubjectSelect }: SubjectSidebarProps) {
  return (
    <div className="h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-teal-600" />
          <h3 className="text-gray-800">Subjects</h3>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {subjects.map((subject) => (
          <Card
            key={subject.id}
            onClick={() => onSubjectSelect(subject.id)}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedSubject === subject.id
                ? 'ring-2 ring-teal-500 shadow-md'
                : 'hover:ring-1 hover:ring-gray-300'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-12 rounded-full ${subject.color}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${
                    selectedSubject === subject.id
                      ? 'text-teal-700 font-medium'
                      : 'text-gray-800'
                  }`}>
                    {subject.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedSubject === subject.id
                          ? 'bg-teal-100 text-teal-700 border-teal-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {subject.questionCount} questions
                    </Badge>
                  </div>
                </div>
                {selectedSubject === subject.id && (
                  <ChevronRight className="size-5 text-teal-600 flex-shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
