import { expect, it, describe } from 'vitest';
import { questionPagesByGroup, getGroupsInfo, questionDisplayNumbers } from './question-pages';
import type { StudentQuestion } from '../../types/student-exam';

describe('questionDisplayNumbers', () => {
  it('numbers grouped questions hierarchically: group as unit, questions as sub-numbers', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2, 3], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 5, block: block1 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[1].label).toBe('1.2');
    expect(displayNumbers[2].label).toBe('1.3');
  });

  it('numbers single questions sequentially based on unit count', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2, 3, 4, 5], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 5, block: block1 } },
      { id: 4, text: 'Q4', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 4, questions_per_page: 5, block: block1 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 5, questions_per_page: 5, block: block1 } },
      // Single question after a group - should be unit 2, not 6
      { id: 6, text: 'Q6 (single)', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 6, questions_per_page: 5 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    // Group 1 questions: 1.1, 1.2, 1.3, 1.4, 1.5
    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[1].label).toBe('1.2');
    expect(displayNumbers[2].label).toBe('1.3');
    expect(displayNumbers[3].label).toBe('1.4');
    expect(displayNumbers[4].label).toBe('1.5');
    
    // Single question after group: should be 2, NOT 6
    expect(displayNumbers[5].label).toBe('2');
  });

  it('handles mixed groups and single questions correctly', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2, 3, 4, 5], keep_order: true, keep_together: true, pinned_position: null };
    const block2 = { block_id: 2, kind: 'group' as const, title: 'Group 2', question_ids: [7, 8], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 5, block: block1 } },
      { id: 4, text: 'Q4', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 4, questions_per_page: 5, block: block1 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 5, questions_per_page: 5, block: block1 } },
      // Single question: unit 2
      { id: 6, text: 'Q6 (single)', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 6, questions_per_page: 5 } },
      // Group 2: unit 3
      { id: 7, text: 'Q7', type: 'essay', points: 1, options: [], layout: { page: 2, slot: 1, position: 7, questions_per_page: 5, block: block2 } },
      { id: 8, text: 'Q8', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 8, questions_per_page: 5, block: block2 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    // Group 1: 1.1 - 1.5
    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[1].label).toBe('1.2');
    expect(displayNumbers[2].label).toBe('1.3');
    expect(displayNumbers[3].label).toBe('1.4');
    expect(displayNumbers[4].label).toBe('1.5');
    
    // Single question: 2
    expect(displayNumbers[5].label).toBe('2');
    
    // Group 2: 3.1 - 3.2 (NOT 2.1 - 2.2)
    expect(displayNumbers[6].label).toBe('3.1');
    expect(displayNumbers[7].label).toBe('3.2');
  });

  it('handles multiple single questions correctly', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: block1 } },
      // Single question: unit 2
      { id: 3, text: 'Q3 (single)', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 3, questions_per_page: 5 } },
      // Another single question: unit 3
      { id: 4, text: 'Q4 (single)', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 4, questions_per_page: 5 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    // Group 1: 1.1 - 1.2
    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[1].label).toBe('1.2');
    
    // Single questions: 2, 3
    expect(displayNumbers[2].label).toBe('2');
    expect(displayNumbers[3].label).toBe('3');
  });
});

describe('questionPagesByGroup', () => {
  it('treats each group as 1 unit for pagination', () => {
    // 2 groups per page, so each page should have at most 2 groups
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
    const block2 = { block_id: 2, kind: 'group' as const, title: 'Group 2', question_ids: [3, 4], keep_order: true, keep_together: true, pinned_position: null };
    const block3 = { block_id: 3, kind: 'group' as const, title: 'Group 3', question_ids: [5, 6], keep_order: true, keep_together: true, pinned_position: null };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 2, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 2, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 2, position: 3, questions_per_page: 2, block: block2 } },
      { id: 4, text: 'Q4', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 2, position: 4, questions_per_page: 2, block: block2 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 5, questions_per_page: 2, block: block3 } },
      { id: 6, text: 'Q6', type: 'essay', points: 1, options: [], layout: { page: 2, slot: 1, position: 6, questions_per_page: 2, block: block3 } },
    ];

    const pages = questionPagesByGroup(questions, 2); // 2 groups per page

    // Page 1 should have 2 groups (all questions from blocks 1 and 2)
    expect(pages[0].length).toBe(4); // 2 questions from block1 + 2 questions from block2
    expect(pages[0].map(q => q.id)).toEqual([1, 2, 3, 4]);

    // Page 2 should have 1 group (all questions from block 3)
    expect(pages[1].length).toBe(2); // 2 questions from block3
    expect(pages[1].map(q => q.id)).toEqual([5, 6]);
  });

  it('keeps groups together on the same page', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2, 3], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 2, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 2, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 2, block: block1 } },
    ];

    const pages = questionPagesByGroup(questions, 2); // 2 groups per page

    // All questions in block1 should be on the same page, even though 2 groups per page
    expect(pages.length).toBe(1);
    expect(pages[0].map(q => q.id)).toEqual([1, 2, 3]);
  });

  it('handles ungrouped questions correctly', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 2, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 2, block: block1 } },
      { id: 3, text: 'Q3 (ungrouped)', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 3, questions_per_page: 2 } },
    ];

    const pages = questionPagesByGroup(questions, 2); // 2 groups/units per page

    // Page 1 has 1 group (1 unit) and 1 ungrouped question (1 unit) = 2 units, fits on 1 page
    expect(pages[0].map(q => q.id)).toEqual([1, 2, 3]);

    // Only 1 page since 1 group + 1 ungrouped = 2 units, which fits on 1 page
    expect(pages.length).toBe(1);
  });

  it('respects the perPage setting correctly', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1], keep_order: true, keep_together: true, pinned_position: null };
    const block2 = { block_id: 2, kind: 'group' as const, title: 'Group 2', question_ids: [2], keep_order: true, keep_together: true, pinned_position: null };
    const block3 = { block_id: 3, kind: 'group' as const, title: 'Group 3', question_ids: [3], keep_order: true, keep_together: true, pinned_position: null };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 1, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 2, slot: 1, position: 2, questions_per_page: 1, block: block2 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 3, questions_per_page: 1, block: block3 } },
    ];

    // 1 group per page
    const pagesPerOne = questionPagesByGroup(questions, 1);
    expect(pagesPerOne.length).toBe(3);
    expect(pagesPerOne[0].map(q => q.id)).toEqual([1]);
    expect(pagesPerOne[1].map(q => q.id)).toEqual([2]);
    expect(pagesPerOne[2].map(q => q.id)).toEqual([3]);
  });
});

describe('getGroupsInfo', () => {
  it('provides correct group information for navigation', () => {
    const block1 = { block_id: 1, kind: 'group' as const, title: 'Group 1', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
    const block2 = { block_id: 2, kind: 'group' as const, title: 'Group 2', question_ids: [3, 4], keep_order: true, keep_together: true, pinned_position: null };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 2, block: block1 } },
      { id: 2, text: 'Q2', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 2, block: block1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 2, position: 3, questions_per_page: 2, block: block2 } },
      { id: 4, text: 'Q4', type: 'essay', points: 1, options: [], layout: { page: 1, slot: 2, position: 4, questions_per_page: 2, block: block2 } },
    ];

    const groupsInfo = getGroupsInfo(questions, 2);

    // Should have 2 groups
    expect(groupsInfo.length).toBe(2);

    // Group 1: position 0 on page 0
    expect(groupsInfo[0]).toMatchObject({
      groupId: 1,
      groupNumber: 1,
      pageNumber: 0,
      positionInPage: 0,
      questionIds: [1, 2],
    });

    // Group 2: position 1 on page 0
    expect(groupsInfo[1]).toMatchObject({
      groupId: 2,
      groupNumber: 2,
      pageNumber: 0,
      positionInPage: 1,
      questionIds: [3, 4],
    });
  });
});
