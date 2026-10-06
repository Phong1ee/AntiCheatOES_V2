import type { StudentQuestion } from '../../types/student-exam';

export interface QuestionDisplayNumber {
  label: string;
  groupId?: number;
  groupNumber?: number;
}

/** Derive display-only group numbering from the server's ordered question layout. */
export function questionDisplayNumbers(questions: StudentQuestion[]): QuestionDisplayNumber[] {
  const groupNumbers = new Map<number, number>();
  const groupPositions = new Map<number, number>();
  let nextGroupNumber = 1;
  return questions.map((question, index) => {
    const groupId = question.layout?.block?.block_id;
    if (groupId == null) return { label: String(index + 1) };
    let groupNumber = groupNumbers.get(groupId);
    if (groupNumber == null) {
      groupNumber = nextGroupNumber++;
      groupNumbers.set(groupId, groupNumber);
    }
    const groupPosition = (groupPositions.get(groupId) ?? 0) + 1;
    groupPositions.set(groupId, groupPosition);
    return { label: `${groupNumber}.${groupPosition}`, groupId, groupNumber };
  });
}

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
