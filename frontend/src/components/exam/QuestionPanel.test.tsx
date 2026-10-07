// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QuestionPanel } from './QuestionPanel';
import type { StudentAnswers, StudentQuestion } from '../../types/student-exam';
let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it.each(['group', 'parent'] as const)('renders an inactive %s block and updates completion only after all children are answered', async kind => {
  const block = { block_id: 10, kind, title: 'Shared content', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
  const questions: StudentQuestion[] = [1, 2, 3].map(id => ({ id, text: 'Question', type: id === 1 ? 'multiple-choice' : 'essay', points: 1, options: id === 1 ? [{ id: 11, text: 'Option' }] : [], layout: { page: id < 3 ? 1 : 2, slot: id < 3 ? id : 1, position: id, questions_per_page: 2, block: id < 3 ? block : undefined } }));
  const select = vi.fn();
  const render = async (answers: StudentAnswers, marked: number[] = [], sequential = false) => {
    await act(async () => root.render(<QuestionPanel questions={questions} currentQuestion={2} currentPageQuestionIds={[3]} answers={answers} isOnline saveStatus="Saved" onQuestionSelect={select} answeredCount={Object.keys(answers).length} unansweredQuestions={[]} sequentialNavigation={sequential} markedQuestionIds={marked} />));
  };
  const tile = () => container.querySelector('button[aria-label="Question group 1"]') as HTMLButtonElement;
  await render({});
  expect(tile().className).toContain('bg-gray-100');
  await act(async () => tile().click());
  expect(select).toHaveBeenLastCalledWith(0);
  await render({ 1: { selectedOptionId: 11 }, 2: { answerText: '   ' } });
  expect(tile().className).not.toContain('bg-green-100');
  await act(async () => tile().click());
  expect(select).toHaveBeenLastCalledWith(1);
  await render({ 1: { selectedOptionId: 11 }, 2: { answerText: 'Done' } });
  expect(tile().className).toContain('bg-green-100');
  await render({}, [2]);
  expect(tile().className).toContain('bg-amber-100');
  await render({}, [], true);
  expect(tile().disabled).toBe(true);
  expect(tile().className).toContain('cursor-not-allowed');
});

it('renders inactive standalone questions without a missing group-state variable', async () => {
  const questions: StudentQuestion[] = [1, 2].map(id => ({ id, text: 'Question', type: 'essay', points: 1, options: [] }));
  await act(async () => root.render(<QuestionPanel questions={questions} currentQuestion={0} answers={{ 2: { answerText: 'Done' } }} isOnline saveStatus="Ready" onQuestionSelect={() => {}} answeredCount={1} unansweredQuestions={[]} sequentialNavigation={false} markedQuestionIds={[]} />));
  expect(container.querySelector('button[aria-label="Question 2"]')?.className).toContain('bg-green-100');
});
