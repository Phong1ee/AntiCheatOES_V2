// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../services/api-client';
import { QuestionStructurePanel } from './QuestionStructurePanel';

vi.mock('../../../services/api-client', () => ({ apiClient: { get: vi.fn(() => Promise.resolve({ data: { version: 1, blocks: [], standalone: [{ question_id: 1, pinned_position: null }, { question_id: 2, pinned_position: null }], layout: [{ question_id: 1, position: 1, page: 1, slot: 1 }] } })), put: vi.fn() } }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const button = (scope: ParentNode, text: string) => Array.from(scope.querySelectorAll('button')).find(node => node.textContent?.trim() === text) as HTMLButtonElement;

it('keeps group controls out of the question editor and retains the draft on modal close', async () => {
  const dirty = vi.fn();
  await act(async () => root.render(<QuestionStructurePanel examId={1} subjectId="SUB" onSaved={async () => {}} onDirtyChange={dirty} />));
  expect(document.querySelector('[role=dialog]')).toBeNull();
  expect(container.textContent).not.toContain('Ungrouped questions');
  await act(async () => button(container, 'Manage question groups').click());
  let dialog = document.querySelector('[role=dialog]') as HTMLElement;
  expect(dialog).not.toBeNull();
  const checkbox = dialog.querySelector('input[type=checkbox]') as HTMLInputElement;
  await act(async () => checkbox.click());
  await act(async () => button(dialog, 'Create group from selected').click());
  expect(dialog.textContent).toContain('Question Group 1');
  expect(dialog.querySelectorAll('.structure-block-settings')).toHaveLength(1);
  expect(dialog.querySelectorAll('.structure-block-settings .structure-check')).toHaveLength(1);
  expect(dialog.textContent).not.toContain('Keep together when it fits a page');
  expect(dialog.textContent).not.toContain('Keep all questions on one page (students scroll)');
  expect(dirty).toHaveBeenLastCalledWith(true);
  await act(async () => button(dialog, 'Close').click());
  expect(document.querySelector('[role=dialog]')).toBeNull();
  expect(container.textContent).toContain('draft retained');
  expect(window.confirm).not.toHaveBeenCalled();
  await act(async () => button(container, 'Manage question groups').click());
  dialog = document.querySelector('[role=dialog]') as HTMLElement;
  expect(dialog.textContent).toContain('Question Group 1');
  expect(dialog.querySelector('.structure-question-list .structure-question-name')?.textContent).toBe('1.1');
});

it('opens preview from dialog and explains why unsaved questions block preview', async () => {
  await act(async () => root.render(<QuestionStructurePanel examId={1} subjectId="SUB" questionDirty onSaved={async () => {}} />));
  await act(async () => button(container, 'Manage question groups').click());
  let dialog = document.querySelector('[role=dialog]') as HTMLElement;
  expect(dialog).not.toBeNull();
  await act(async () => button(dialog, 'Student preview').click());
  dialog = document.querySelector('[role=dialog]') as HTMLElement;
  expect(dialog.textContent).toContain('Save question and pool changes');
  expect(dialog.textContent).not.toContain('The saved exam as students will see it.');
  expect(dialog.textContent).not.toContain('Random seed');
  expect(dialog.textContent).not.toContain('Ungrouped questions');
});

it('saves multiple questions pinned to the same page and the page-size setting', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({ data: { version: 2, layout: [] } });
  await act(async () => root.render(<QuestionStructurePanel examId={1} subjectId="SUB" onSaved={async () => {}} />));
  await act(async () => button(container, 'Manage question groups').click());
  const dialog = document.querySelector('[role=dialog]') as HTMLElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  for (const [label, value] of [['Question 1 pin', '1'], ['Question 2 pin', '1'], ['Questions per page', '2']]) {
    const input = dialog.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  await act(async () => button(dialog, 'Save structure').click());
  expect(apiClient.put).toHaveBeenLastCalledWith('/api/teacher/exams/1/question-structure', expect.objectContaining({
    questions_per_page: 2,
    standalone: [
      { question_id: 1, pinned_position: null, pinned_page: 1 },
      { question_id: 2, pinned_position: null, pinned_page: 1 },
    ],
  }));
});
