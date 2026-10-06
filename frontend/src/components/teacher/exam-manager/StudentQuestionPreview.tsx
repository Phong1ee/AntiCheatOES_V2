import { useEffect, useState } from 'react';
import { QuestionPage } from '../../exam/QuestionPage';
import { questionPages } from '../../exam/question-pages';
import type { StudentAnswers, StudentQuestion } from '../../../types/student-exam';
import { Button } from '../../ui/button';

/** Receives the server domain layout; never creates an attempt or saves answers. */
export function StudentQuestionPreview({ questions, mobile = false }: { questions: StudentQuestion[]; mobile?: boolean }) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [marked, setMarked] = useState<number[]>([]);
  useEffect(() => { setPage(0); setAnswers({}); setMarked([]); }, [questions]);
  const pages = questionPages(questions);
  if (!pages.length) return <p>No questions selected for this preview.</p>;
  return <div style={{ maxWidth: mobile ? 390 : 1280 }} className="student-preview-frame mx-auto w-full border bg-slate-50 p-2">
    <QuestionPage questions={pages[page] ?? []} allQuestions={questions} answers={answers} marked={marked}
      onAnswerChange={(id, answer) => setAnswers(a => ({ ...a, [id]: answer }))}
      onToggleMark={id => setMarked(m => m.includes(id) ? m.filter(q => q !== id) : [...m, id])} />
    <div className="flex justify-between items-center gap-3 mt-4"><Button variant="outline" className="structure-action" type="button" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Previous</Button>
      <span>Page {page + 1} / {pages.length}</span><Button variant="outline" className="structure-action" type="button" disabled={page >= pages.length - 1} onClick={() => setPage(v => v + 1)}>Next</Button></div>
  </div>;
}
