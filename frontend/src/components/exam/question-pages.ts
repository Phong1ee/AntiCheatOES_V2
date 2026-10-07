import type { StudentQuestion } from '../../types/student-exam';

export interface QuestionDisplayNumber {
  label: string;
  groupId?: number;
  groupNumber?: number;
}

export interface GroupInfo {
  groupId: number;
  groupNumber: number;
  questionIds: number[];
  pageNumber: number;
  positionInPage: number;
}

/** Derive display-only hierarchical numbering: groups/singles as units (1, 2, 3, ...), questions within groups as sub-numbers (1.1, 1.2, ...). */
export function questionDisplayNumbers(questions: StudentQuestion[]): QuestionDisplayNumber[] {
  // First pass: identify all units (groups and single questions) in order of first appearance
  const unitMap = new Map<number | string, { unitNumber: number; type: 'group' | 'single' }>();
  const seenGroupIds = new Set<number>();
  let unitCounter = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const groupId = question.layout?.block?.block_id;

    if (groupId != null) {
      if (!seenGroupIds.has(groupId)) {
        seenGroupIds.add(groupId);
        unitMap.set(groupId, { unitNumber: unitCounter++, type: 'group' });
      }
    } else {
      // Single question - each gets its own unit
      unitMap.set(`single-${i}`, { unitNumber: unitCounter++, type: 'single' });
    }
  }

  // Second pass: calculate display numbers for each question
  const groupPositions = new Map<number, number>(); // groupId -> position within group (1, 2, 3, ...)

  return questions.map((question, index) => {
    const groupId = question.layout?.block?.block_id;

    if (groupId == null) {
      // Single question
      const unitInfo = unitMap.get(`single-${index}`);
      const unitNumber = unitInfo?.unitNumber ?? 0;
      return { label: String(unitNumber + 1) };
    } else {
      // Grouped question
      const unitInfo = unitMap.get(groupId);
      const unitNumber = unitInfo?.unitNumber ?? 0;
      const positionInGroup = (groupPositions.get(groupId) ?? 0) + 1;
      groupPositions.set(groupId, positionInGroup);
      return { label: `${unitNumber + 1}.${positionInGroup}`, groupId, groupNumber: unitNumber + 1 };
    }
  });
}

/** Group-based pagination: each Question Group counts as 1 unit for "questions per page" */
export function questionPagesByGroup(questions: StudentQuestion[], perPage = 1): StudentQuestion[][] {
  // Build an ordered list of units (groups and ungrouped questions) preserving order of first appearance
  const units: Array<{ type: 'group' | 'single'; groupId?: number; questions: StudentQuestion[] }> = [];
  const seenGroupIds = new Set<number>();

  for (const question of questions) {
    const groupId = question.layout?.block?.block_id;
    
    if (groupId != null) {
      if (!seenGroupIds.has(groupId)) {
        seenGroupIds.add(groupId);
        // Collect all questions in this group
        const groupQuestions = questions.filter(q => q.layout?.block?.block_id === groupId);
        units.push({ type: 'group', groupId, questions: groupQuestions });
      }
    } else {
      // Single (ungrouped) question
      units.push({ type: 'single', questions: [question] });
    }
  }

  // Distribute units across pages based on perPage setting
  const pages: StudentQuestion[][] = [];
  let currentPage: StudentQuestion[] = [];
  let itemsOnCurrentPage = 0;

  for (const unit of units) {
    if (itemsOnCurrentPage >= perPage && itemsOnCurrentPage > 0) {
      pages.push(currentPage);
      currentPage = [];
      itemsOnCurrentPage = 0;
    }
    currentPage.push(...unit.questions);
    itemsOnCurrentPage++;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/** Get group information for navigation */
export function getGroupsInfo(questions: StudentQuestion[], perPage = 1): GroupInfo[] {
  const pages = questionPagesByGroup(questions, perPage);
  const groupMap = new Map<number, { groupNumber: number; questionIds: number[] }>();
  let nextGroupNumber = 1;

  const groupsInfo: GroupInfo[] = [];

  pages.forEach((pageQuestions, pageIndex) => {
    let positionInPage = 0;
    const seenGroupsOnPage = new Set<number>();

    pageQuestions.forEach((question) => {
      const groupId = question.layout?.block?.block_id;
      if (groupId == null) return;

      if (!seenGroupsOnPage.has(groupId)) {
        seenGroupsOnPage.add(groupId);
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, { groupNumber: nextGroupNumber++, questionIds: [] });
        }
        const info = groupMap.get(groupId)!;
        groupsInfo.push({
          groupId,
          groupNumber: info.groupNumber,
          questionIds: questions
            .filter((q) => q.layout?.block?.block_id === groupId)
            .map((q) => q.id),
          pageNumber: pageIndex,
          positionInPage,
        });
        positionInPage++;
      }

      const info = groupMap.get(groupId);
      if (info && !info.questionIds.includes(question.id)) {
        info.questionIds.push(question.id);
      }
    });
  });

  return groupsInfo;
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
