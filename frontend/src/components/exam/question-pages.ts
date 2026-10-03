import type { StudentQuestion } from '../../types/student-exam';

/** The server's snapshotted layout is authoritative for students and preview. */
export function questionPages(questions: StudentQuestion[], perPage = 1): StudentQuestion[][] {
  const pages = new Map<number, StudentQuestion[]>();
  questions.forEach((question, index) => {
    const page = question.layout?.page ?? Math.floor(index / Math.max(1, perPage)) + 1;
    pages.set(page, [...(pages.get(page) ?? []), question]);
  });
  return [...pages.entries()].sort(([a], [b]) => a - b).map(([, rows]) => rows);
}

export function pageIndexForQuestion(pages: StudentQuestion[][], id: number): number {
  return Math.max(0, pages.findIndex(page => page.some(q => q.id === id)));
}
