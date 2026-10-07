import { expect, it, describe } from 'vitest';
import { questionDisplayNumbers, questionPagesByGroup } from './question-pages';
import type { StudentQuestion } from '../../types/student-exam';

/**
 * Integration tests for hierarchical question numbering.
 * 
 * Requirement: Question Groups are units, and questions within them are sub-numbered.
 * - Group 1 (5 questions) → 1.1, 1.2, 1.3, 1.4, 1.5
 * - Single question → 2
 * - Group 2 (2 questions) → 3.1, 3.2
 */

describe('Hierarchical Question Numbering Integration', () => {
  it('complete student exam flow with mixed groups and single questions', () => {
    // Scenario: Teacher creates exam with:
    // - Question Group 1 with 5 questions
    // - 1 single question
    // - Question Group 2 with 2 questions
    // - 1 single question
    // - Question Group 3 with 3 questions
    // Total: 12 questions, 5 units

    const group1 = {
      block_id: 1,
      kind: 'group' as const,
      title: 'Passage 1',
      question_ids: [1, 2, 3, 4, 5],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group2 = {
      block_id: 2,
      kind: 'group' as const,
      title: 'Passage 2',
      question_ids: [7, 8],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group3 = {
      block_id: 3,
      kind: 'group' as const,
      title: 'Passage 3',
      question_ids: [10, 11, 12],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: group1 } },
      { id: 2, text: 'Q2', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: group1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 5, block: group1 } },
      { id: 4, text: 'Q4', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 4, questions_per_page: 5, block: group1 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 5, questions_per_page: 5, block: group1 } },
      // Single question (unit 2)
      { id: 6, text: 'Q6 (single)', type: 'essay', points: 2, options: [], layout: { page: 2, slot: 1, position: 6, questions_per_page: 5 } },
      // Group 2 (unit 3)
      { id: 7, text: 'Q7', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 7, questions_per_page: 5, block: group2 } },
      { id: 8, text: 'Q8', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 8, questions_per_page: 5, block: group2 } },
      // Single question (unit 4)
      { id: 9, text: 'Q9 (single)', type: 'essay', points: 2, options: [], layout: { page: 3, slot: 1, position: 9, questions_per_page: 5 } },
      // Group 3 (unit 5)
      { id: 10, text: 'Q10', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 10, questions_per_page: 5, block: group3 } },
      { id: 11, text: 'Q11', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 11, questions_per_page: 5, block: group3 } },
      { id: 12, text: 'Q12', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 12, questions_per_page: 5, block: group3 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    // Verify Group 1 (unit 1): 1.1, 1.2, 1.3, 1.4, 1.5
    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[1].label).toBe('1.2');
    expect(displayNumbers[2].label).toBe('1.3');
    expect(displayNumbers[3].label).toBe('1.4');
    expect(displayNumbers[4].label).toBe('1.5');
    expect(displayNumbers[0].groupNumber).toBe(1);
    expect(displayNumbers[4].groupNumber).toBe(1);

    // Verify single question (unit 2): 2
    expect(displayNumbers[5].label).toBe('2');
    expect(displayNumbers[5].groupNumber).toBeUndefined();

    // Verify Group 2 (unit 3): 3.1, 3.2
    expect(displayNumbers[6].label).toBe('3.1');
    expect(displayNumbers[7].label).toBe('3.2');
    expect(displayNumbers[6].groupNumber).toBe(3);
    expect(displayNumbers[7].groupNumber).toBe(3);

    // Verify single question (unit 4): 4
    expect(displayNumbers[8].label).toBe('4');
    expect(displayNumbers[8].groupNumber).toBeUndefined();

    // Verify Group 3 (unit 5): 5.1, 5.2, 5.3
    expect(displayNumbers[9].label).toBe('5.1');
    expect(displayNumbers[10].label).toBe('5.2');
    expect(displayNumbers[11].label).toBe('5.3');
    expect(displayNumbers[9].groupNumber).toBe(5);
    expect(displayNumbers[11].groupNumber).toBe(5);
  });

  it('pagination treats each unit (group or single) as one item', () => {
    // Scenario: "2 questions per page" really means "2 units per page"
    // 5 units total = 3 pages
    // Page 1: Unit 1 (5 Qs) + Unit 2 (1 Q)
    // Page 2: Unit 3 (2 Qs) + Unit 4 (1 Q)
    // Page 3: Unit 5 (3 Qs)

    const group1 = {
      block_id: 1,
      kind: 'group' as const,
      title: 'Group 1',
      question_ids: [1, 2, 3, 4, 5],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group2 = {
      block_id: 2,
      kind: 'group' as const,
      title: 'Group 2',
      question_ids: [7, 8],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group3 = {
      block_id: 3,
      kind: 'group' as const,
      title: 'Group 3',
      question_ids: [10, 11, 12],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 2, block: group1 } },
      { id: 2, text: 'Q2', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 2, block: group1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 2, block: group1 } },
      { id: 4, text: 'Q4', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 4, questions_per_page: 2, block: group1 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 5, questions_per_page: 2, block: group1 } },
      { id: 6, text: 'Q6 (single)', type: 'essay', points: 2, options: [], layout: { page: 1, slot: 1, position: 6, questions_per_page: 2 } },
      { id: 7, text: 'Q7', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 7, questions_per_page: 2, block: group2 } },
      { id: 8, text: 'Q8', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 8, questions_per_page: 2, block: group2 } },
      { id: 9, text: 'Q9 (single)', type: 'essay', points: 2, options: [], layout: { page: 2, slot: 1, position: 9, questions_per_page: 2 } },
      { id: 10, text: 'Q10', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 10, questions_per_page: 2, block: group3 } },
      { id: 11, text: 'Q11', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 11, questions_per_page: 2, block: group3 } },
      { id: 12, text: 'Q12', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 12, questions_per_page: 2, block: group3 } },
    ];

    const pages = questionPagesByGroup(questions, 2);

    // Page 1: Unit 1 (Group 1, 5 Qs) + Unit 2 (single, 1 Q) = 6 total questions
    expect(pages[0].length).toBe(6);
    expect(pages[0].map(q => q.id)).toEqual([1, 2, 3, 4, 5, 6]);

    // Page 2: Unit 3 (Group 2, 2 Qs) + Unit 4 (single, 1 Q) = 3 total questions
    expect(pages[1].length).toBe(3);
    expect(pages[1].map(q => q.id)).toEqual([7, 8, 9]);

    // Page 3: Unit 5 (Group 3, 3 Qs) = 3 total questions
    expect(pages[2].length).toBe(3);
    expect(pages[2].map(q => q.id)).toEqual([10, 11, 12]);

    // Verify numbering is consistent
    const displayNumbers = questionDisplayNumbers(questions);

    // Page 1 questions should have numbers: 1.1-1.5, 2
    expect(displayNumbers[0].label).toBe('1.1');
    expect(displayNumbers[4].label).toBe('1.5');
    expect(displayNumbers[5].label).toBe('2');

    // Page 2 questions should have numbers: 3.1-3.2, 4
    expect(displayNumbers[6].label).toBe('3.1');
    expect(displayNumbers[7].label).toBe('3.2');
    expect(displayNumbers[8].label).toBe('4');

    // Page 3 questions should have numbers: 5.1-5.3
    expect(displayNumbers[9].label).toBe('5.1');
    expect(displayNumbers[11].label).toBe('5.3');
  });

  it('navigation bar displays one button per unit (group or single)', () => {
    // The navigation bar should show:
    // - Button "1" for Group 1 (all 5 questions)
    // - Button "2" for single question
    // - Button "3" for Group 2 (all 2 questions)
    // - Button "4" for single question
    // - Button "5" for Group 3 (all 3 questions)

    const group1 = {
      block_id: 1,
      kind: 'group' as const,
      title: 'Group 1',
      question_ids: [1, 2, 3, 4, 5],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group2 = {
      block_id: 2,
      kind: 'group' as const,
      title: 'Group 2',
      question_ids: [7, 8],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const group3 = {
      block_id: 3,
      kind: 'group' as const,
      title: 'Group 3',
      question_ids: [10, 11, 12],
      keep_order: true,
      keep_together: true,
      pinned_position: null,
    };

    const questions: StudentQuestion[] = [
      { id: 1, text: 'Q1', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 1, questions_per_page: 5, block: group1 } },
      { id: 2, text: 'Q2', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 2, questions_per_page: 5, block: group1 } },
      { id: 3, text: 'Q3', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 3, questions_per_page: 5, block: group1 } },
      { id: 4, text: 'Q4', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 4, questions_per_page: 5, block: group1 } },
      { id: 5, text: 'Q5', type: 'multiple-choice', points: 1, options: [], layout: { page: 1, slot: 1, position: 5, questions_per_page: 5, block: group1 } },
      { id: 6, text: 'Q6 (single)', type: 'essay', points: 2, options: [], layout: { page: 2, slot: 1, position: 6, questions_per_page: 5 } },
      { id: 7, text: 'Q7', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 7, questions_per_page: 5, block: group2 } },
      { id: 8, text: 'Q8', type: 'multiple-choice', points: 1, options: [], layout: { page: 2, slot: 1, position: 8, questions_per_page: 5, block: group2 } },
      { id: 9, text: 'Q9 (single)', type: 'essay', points: 2, options: [], layout: { page: 3, slot: 1, position: 9, questions_per_page: 5 } },
      { id: 10, text: 'Q10', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 10, questions_per_page: 5, block: group3 } },
      { id: 11, text: 'Q11', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 11, questions_per_page: 5, block: group3 } },
      { id: 12, text: 'Q12', type: 'multiple-choice', points: 1, options: [], layout: { page: 3, slot: 1, position: 12, questions_per_page: 5, block: group3 } },
    ];

    const displayNumbers = questionDisplayNumbers(questions);

    // Extract navigation entries (one per unit)
    const navigationEntries: Array<{ label: string; groupNumber?: number; type: 'group' | 'single' }> = [];
    const groupEntries = new Map<number, { label: string; groupNumber: number }>();

    for (let i = 0; i < questions.length; i++) {
      const display = displayNumbers[i];

      if (display.groupId == null || display.groupNumber == null) {
        // Single question
        navigationEntries.push({ label: display.label, type: 'single' });
      } else if (!groupEntries.has(display.groupId)) {
        // First encounter with this group
        const entry = { label: String(display.groupNumber), groupNumber: display.groupNumber };
        groupEntries.set(display.groupId, entry);
        navigationEntries.push({ ...entry, type: 'group' });
      }
    }

    // Verify we have exactly 5 navigation entries (one per unit)
    expect(navigationEntries.length).toBe(5);

    // Verify navigation labels
    expect(navigationEntries[0].label).toBe('1');
    expect(navigationEntries[0].type).toBe('group');

    expect(navigationEntries[1].label).toBe('2');
    expect(navigationEntries[1].type).toBe('single');

    expect(navigationEntries[2].label).toBe('3');
    expect(navigationEntries[2].type).toBe('group');

    expect(navigationEntries[3].label).toBe('4');
    expect(navigationEntries[3].type).toBe('single');

    expect(navigationEntries[4].label).toBe('5');
    expect(navigationEntries[4].type).toBe('group');
  });
});
