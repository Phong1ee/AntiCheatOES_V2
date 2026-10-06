// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RichContent, RichText, sanitizeHTML, richPlain } from './RichContent';
import { RichEditor } from './RichEditor';
import { ContentEditor } from './ContentEditor';
import { QuestionPage } from '../exam/QuestionPage';
import { questionPages, pageIndexForQuestion, questionDisplayNumbers } from '../exam/question-pages';
import type { StudentQuestion } from '../../types/student-exam';

vi.mock('../../services/api-client', () => ({ apiClient: { get: vi.fn(() => Promise.resolve({ data: new Blob(['test']) })), post: vi.fn(() => Promise.resolve({ data: { media_id: 'a'.repeat(64), kind: 'image' } })) } }));
let container: HTMLDivElement; let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };

it('removes executable HTML, attributes, URLs and foreign namespaces', async () => {
  const html = '<p style="color:red" onclick="alert(1)">Safe</p><svg><script>x</script></svg><iframe src="javascript:x"></iframe><img src=x onerror=x><a href="javascript:x">Link</a>';
  const safe = sanitizeHTML(html);
  expect(safe).not.toMatch(/script|svg|iframe|onclick|onerror|href|style=/);
  await render(<RichText html={html} />);
  expect(container.querySelector('script,iframe,svg,img,a')).toBeNull();
  expect(container.textContent).toContain('Safe');
});

it('preserves legacy literal text and Unicode', async () => {
  await render(<RichText text={'<b>literal</b> α ไทย Tiếng Việt'} />);
  expect(container.textContent).toBe('<b>literal</b> α ไทย Tiếng Việt');
  expect(container.querySelector('b')).toBeNull();
});

it('renders inline/block formulas and contains syntax errors', async () => {
  await render(<RichText html={'<span data-math="x^2" data-display="inline"></span><div data-math="\\frac{1}{2}" data-display="block"></div><span data-math="\\invalidcommand"></span>'} />);
  expect(container.querySelectorAll('.katex').length).toBe(2);
  expect(container.textContent).toContain('Invalid formula');
});

describe.each([[true, false, false], [false, true, false], [false, false, true], [true, true, false], [true, false, true], [false, true, true], [true, true, true]])('content combination text=%s image=%s audio=%s', (text, image, audio) => {
  const content = { rich_html: text ? '<strong>Rich</strong>' : null, image_media_id: image ? 'a'.repeat(64) : null, audio_media_id: audio ? 'b'.repeat(64) : null, image_alt: 'Diagram' };
  it('renders independently in the student page body and option', async () => {
    const question: StudentQuestion = { id: 1, text: text ? 'Rich' : '', ...content, type: 'multiple-choice', points: 1, attemptId: 3, options: [{ id: 11, text: text ? 'Rich' : '', ...content }] };
    await render(<QuestionPage questions={[question]} allQuestions={[question]} answers={{}} onAnswerChange={() => {}} onToggleMark={() => {}} />);
    expect(container.querySelectorAll('img')).toHaveLength(image ? 2 : 0);
    expect(container.querySelectorAll('audio')).toHaveLength(audio ? 2 : 0);
    if (audio) { expect(container.querySelector('audio')?.autoplay).toBe(false); expect(container.querySelector('audio')?.controls).toBe(true); }
    expect(container.querySelectorAll('strong')).toHaveLength(text ? 2 : 0);
  });
  it('restores teacher content and media independently', async () => {
    await render(<ContentEditor content={content} text={text ? 'Rich' : ''} subjectId="SUB" label="Question" onChange={() => {}} />);
    expect(container.querySelectorAll('img')).toHaveLength(image ? 1 : 0);
    expect(container.querySelectorAll('audio')).toHaveLength(audio ? 1 : 0);
    expect(container.querySelector('[role=textbox]')?.textContent).toBe(text ? 'Rich' : '');
  });
});

it('serializes rich editor changes and strips pasted payloads', async () => {
  const change = vi.fn();
  await render(<RichEditor value="<p>Old</p>" label="Question" onChange={change} />);
  const textbox = container.querySelector('[role=textbox]') as HTMLDivElement;
  await act(async () => { textbox.innerHTML = '<p><b>New</b><img src=x onerror=x></p>'; textbox.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(change).toHaveBeenLastCalledWith('<p><b>New</b></p>');
  expect(richPlain(change.mock.calls[0][0])).toBe('New');
  const preview = [...container.querySelectorAll('button')].find(b => b.textContent === 'Preview')!;
  await act(async () => preview.click());
  expect(document.body.querySelector('[role=dialog]')?.textContent).toContain('Old');
  expect(container.querySelector('[role=textbox]')).not.toBeNull();
});

it('shows accessible media failure and retry', async () => {
  const { apiClient } = await import('../../services/api-client');
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Denied'));
  await render(<RichContent content={{ audio_media_id: 'b'.repeat(64) }} />);
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Unable to load audio');
  await act(async () => container.querySelector('button')?.click());
  expect(container.querySelector('audio')).not.toBeNull();
});

it('uses snapshotted pages and repeated parent continuation headers', async () => {
  const block = { block_id: 1, kind: 'parent' as const, title: 'Passage', question_ids: [1, 2, 3], keep_order: true, keep_together: true, pinned_position: null, rich_html: '<b>Read this</b>' };
  const questions: StudentQuestion[] = [1, 2, 3].map(id => ({ id, text: 'Q', type: 'essay', points: 1, options: [], layout: { page: id < 3 ? 1 : 2, slot: id < 3 ? id : 1, position: id, questions_per_page: 2, block, continuation: id === 3 } }));
  const pages = questionPages(questions, 50);
  expect(pages.map(p => p.length)).toEqual([2, 1]);
  expect(pageIndexForQuestion(pages, 3)).toBe(1);
  await render(<QuestionPage questions={pages[1]} allQuestions={questions} answers={{ 3: { answerText: 'saved' } }} marked={[3]} onAnswerChange={() => {}} onToggleMark={() => {}} />);
  expect(container.textContent).toContain('(continued)');
  expect(container.querySelector('textarea')?.value).toBe('saved');
  expect(container.textContent).toContain('Marked for review');
});

it('numbers grouped questions hierarchically and marks a group answered only when all children are answered', async () => {
  const firstBlock = { block_id: 10, kind: 'group' as const, title: 'Algebra', question_ids: [1, 2], keep_order: true, keep_together: true, pinned_position: null };
  const secondBlock = { block_id: 20, kind: 'group' as const, title: 'Geometry', question_ids: [3, 4], keep_order: true, keep_together: true, pinned_position: null };
  const questions: StudentQuestion[] = [firstBlock, firstBlock, secondBlock, secondBlock].map((block, index) => ({
    id: index + 1, text: `Question ${index + 1}`, type: 'essay', points: 1, options: [],
    layout: { page: block.block_id === 10 ? 1 : 2, slot: index % 2 + 1, position: index + 1, questions_per_page: 1, block },
  }));
  expect(questionDisplayNumbers(questions).map(item => item.label)).toEqual(['1.1', '1.2', '2.1', '2.2']);
  const panel = await import('../exam/QuestionPanel');
  const panelProps = { questions, currentQuestion: 3, answers: { 1: { answerText: 'done' } }, markedQuestionIds: [], answeredCount: 1, unansweredQuestions: [2, 3, 4], onQuestionSelect: () => {}, isOnline: true, saveStatus: 'Saved', sequentialNavigation: false };
  await render(<QuestionPage questions={questions.slice(0, 2)} allQuestions={questions} answers={{}} onAnswerChange={() => {}} onToggleMark={() => {}} />);
  expect(container.textContent).toContain('Question group 1: Algebra');
  expect(container.textContent).toContain('Question 1.1 of 4');

  await render(<panel.QuestionPanel {...panelProps} />);
  const tile = (label: string) => container.querySelector(`button[aria-label="Question ${label}"]`)!;
  expect(tile('1.1').className).not.toContain('bg-green-100');
  expect(tile('1.2').className).not.toContain('bg-green-100');

  await render(<panel.QuestionPanel {...panelProps} answers={{ 1: { answerText: 'done' }, 2: { answerText: 'done' } }} answeredCount={2} unansweredQuestions={[3, 4]} />);
  expect(tile('1.1').className).toContain('bg-green-100');
  expect(tile('1.2').className).toContain('bg-green-100');
  expect(tile('2.1').className).not.toContain('bg-green-100');
});


it('keeps navigation within a sequential page and shows all page states', async () => {
  const { QuestionPanel } = await import('../exam/QuestionPanel');
  const select = vi.fn();
  const questions: StudentQuestion[] = [1, 2, 3].map(id => ({ id, text: 'Q', type: 'essay', points: 1, options: [] }));
  await render(<QuestionPanel questions={questions} currentQuestion={0} currentPageQuestionIds={[1, 2]} answers={{ 1: { answerText: 'saved' } }} markedQuestionIds={[2]} answeredCount={1} unansweredQuestions={[2, 3]} onQuestionSelect={select} isOnline saveStatus="Saved" sequentialNavigation />);
  const buttons = [...container.querySelectorAll('button')];
  expect(buttons.slice(0, 2).every(b => !b.disabled)).toBe(true);
  expect(buttons[2].disabled).toBe(true);
  await act(async () => buttons[1].click());
  expect(select).toHaveBeenCalledWith(1);
});

it('teacher preview renders the same snapshot page and local answers only', async () => {
  const { StudentQuestionPreview } = await import('../teacher/exam-manager/StudentQuestionPreview');
  const questions: StudentQuestion[] = [1, 2].map(id => ({ id, text: 'Q', rich_html: '<b>Snapshot</b>', type: 'essay', points: 1, options: [], layout: { page: id, slot: 1, position: id, questions_per_page: 1 } }));
  await render(<StudentQuestionPreview questions={questions} mobile />);
  expect(container.querySelector('strong,b')?.textContent).toBe('Snapshot');
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Next')!.click());
  expect(container.textContent).toContain('Page 2 / 2');
});

it('bounds deeply nested untrusted content', () => {
  expect(sanitizeHTML('<div>'.repeat(3000) + 'x' + '</div>'.repeat(3000)).length).toBeLessThan(2000);
});


it('recovers a formula after its syntax is corrected', async () => {
  await render(<RichText html={'<span data-math="\\invalidcommand"></span>'} />);
  expect(container.textContent).toContain('Invalid formula');
  await render(<RichText html={'<span data-math="x^2"></span>'} />);
  expect(container.textContent).not.toContain('Invalid formula');
  expect(container.querySelector('.katex')).not.toBeNull();
});


it('retains text and saved media when an upload fails', async () => {
  const { apiClient } = await import('../../services/api-client');
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { removed: 0 } } as never).mockRejectedValueOnce(new Error('Upload rejected'));
  const change = vi.fn();
  await render(<ContentEditor content={{ rich_html: '<b>Keep me</b>' }} text="Keep me" subjectId="SUB" label="Question" onChange={change} />);
  const fileInput = container.querySelector('input[type=file]')!;
  Object.defineProperty(fileInput, 'files', { value: [new File(['bad'], 'bad.png', { type: 'image/png' })] });
  await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Upload rejected');
  expect(container.querySelector('[role=textbox]')?.textContent).toBe('Keep me');
  expect(change).not.toHaveBeenCalled();
});


it('does not enable dangerous links inside mathematical notation', async () => {
  await render(<RichText html={'<span data-math="\\href{javascript:alert(1)}{x}"></span>'} />);
  expect(container.querySelector('a[href],script,iframe')).toBeNull();
});


it('shows preview in a dialog without replacing the edited content', async () => {
  function Harness() { const [value, setValue] = useState('<p>Old</p>'); return <RichEditor label="Body" value={value} onChange={setValue} />; }
  await render(<Harness />);
  const textbox = container.querySelector('[role=textbox]')!;
  await act(async () => { textbox.innerHTML = '<p><b>Saved draft</b><sub>2</sub></p>'; textbox.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Preview')!.click());
  expect(document.body.querySelector('[role=dialog] b')?.textContent).toBe('Saved draft');
  expect(container.querySelector('[role=textbox] b')?.textContent).toBe('Saved draft');
  expect(container.querySelector('[role=textbox] sub')?.textContent).toBe('2');
});


it('keeps true/false semantics when media-only options are reversed', async () => {
  const { trueFalseSemantic } = await import('./content-utils');
  expect(trueFalseSemantic('', 0, { semantic_value: 'false' })).toBe('false');
  expect(trueFalseSemantic('False', 0)).toBe('false');
  const question: StudentQuestion = { id: 1, text: 'Q', type: 'true-false', points: 1, options: [{ id: 12, text: '', semantic_value: 'false', audio_media_id: 'b'.repeat(64) }, { id: 11, text: '', semantic_value: 'true', image_media_id: 'a'.repeat(64) }] };
  await render(<QuestionPage questions={[question]} allQuestions={[question]} answers={{ 1: { selectedOptionId: 11 } }} onAnswerChange={() => {}} onToggleMark={() => {}} />);
  const radios = [...container.querySelectorAll('input[type=radio]')] as HTMLInputElement[];
  expect(radios[0].getAttribute('aria-label')).toContain('False');
  expect(radios[1].getAttribute('aria-label')).toContain('True');
  expect(radios[1].checked).toBe(true);
});

it('honors two page pins even when the default is one question per page', async () => {
  const { StudentQuestionPreview } = await import('../teacher/exam-manager/StudentQuestionPreview');
  const questions: StudentQuestion[] = [1, 2, 3].map(id => ({ id, text: `Pinned question ${id}`, type: 'essay', points: 1, options: [], layout: { page: id < 3 ? 1 : 2, slot: id < 3 ? id : 1, position: id, questions_per_page: 1 } }));
  expect(questionPages(questions, 1).map(page => page.length)).toEqual([2, 1]);
  await render(<StudentQuestionPreview questions={questions} />);
  expect(container.textContent).toContain('Pinned question 1');
  expect(container.textContent).toContain('Pinned question 2');
  expect(container.textContent).not.toContain('Pinned question 3');
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Next')!.click());
  expect(container.textContent).toContain('Pinned question 3');
  expect(container.textContent).toContain('Page 2 / 2');
});

it('paginates legacy questions without snapshot layout by the exam page size', () => {
  const questions: StudentQuestion[] = [1, 2, 3, 4, 5].map(id => ({ id, text: 'Question', type: 'essay', points: 1, options: [] }));
  const pages = questionPages(questions, 2);
  expect(pages.map(page => page.map(q => q.id))).toEqual([[1, 2], [3, 4], [5]]);
  expect(pageIndexForQuestion(pages, 4)).toBe(1);
});
