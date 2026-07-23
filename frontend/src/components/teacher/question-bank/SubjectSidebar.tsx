import { BookOpen } from 'lucide-react';
import type { SubjectCount } from '../../../types/question-bank';

interface SubjectSidebarProps {
  selectedSubject: string;
  subjects: SubjectCount[];
  totalCount: number;
  loading: boolean;
  onSubjectSelect: (subjectId: string) => void;
}

export function SubjectSidebar({
  selectedSubject,
  subjects,
  totalCount,
  loading,
  onSubjectSelect,
}: SubjectSidebarProps) {
  const items = [
    { id: 'all', name: 'All Subjects', count: totalCount },
    ...subjects.map((subject) => ({
      id: subject.subject_id,
      name: subject.subject_name,
      count: subject.question_count,
    })),
  ];

  return (
    <aside className="flex h-full flex-col border-r border-gray-100 bg-white">
      <div className="shrink-0 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2 text-gray-500">
          <BookOpen className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Subjects
          </span>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto p-3"
        aria-label="Question bank subjects"
      >
        {loading ? (
          <div className="flex flex-col gap-0.5" aria-label="Loading subjects">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-10 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {items.map((subject) => {
              const active = selectedSubject === subject.id;
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => onSubjectSelect(subject.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left font-[inherit] transition-colors ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                  aria-pressed={active}
                  title={subject.name}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      active ? 'bg-teal-400' : 'bg-gray-300 group-hover:bg-gray-400'
                    }`}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm leading-tight ${
                      active ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {subject.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${
                      active
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }`}
                  >
                    {subject.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-100 px-5 py-3 text-xs leading-relaxed text-gray-400">
        {totalCount} questions across {subjects.length} subjects
      </div>
    </aside>
  );
}
