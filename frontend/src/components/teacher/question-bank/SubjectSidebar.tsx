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
    <aside className="qb-ref-subject-sidebar">
      <div className="qb-ref-subject-header">
        <div className="qb-ref-subject-header-inner">
          <BookOpen />
          <span>Subjects</span>
        </div>
      </div>

      <nav className="qb-ref-subject-nav" aria-label="Question bank subjects">
        {loading ? (
          <div className="qb-ref-subject-list" aria-label="Loading subjects">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="qb-ref-subject-skeleton" />
            ))}
          </div>
        ) : (
          <div className="qb-ref-subject-list">
            {items.map((subject) => {
              const active = selectedSubject === subject.id;
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => onSubjectSelect(subject.id)}
                  className={`qb-ref-subject-item${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  title={subject.name}
                >
                  <span className="qb-ref-subject-dot" />
                  <span className="qb-ref-subject-name">{subject.name}</span>
                  <span className="qb-ref-subject-count">{subject.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="qb-ref-subject-footer">
        {totalCount} questions across {subjects.length} subjects
      </div>
    </aside>
  );
}