// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentEditor } from './ContentEditor';
import { apiClient } from '../../services/api-client';
vi.mock('../../services/api-client', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('./RichEditor', () => ({ RichEditor: () => <div>Editor</div> }));
vi.mock('./RichContent', () => ({ RichContent: () => <div>Preview</div>, richPlain: (s: string) => s }));
let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it.each(['image', 'audio'] as const)('uploads %s as multipart and stores the returned immutable reference', async kind => {
  vi.mocked(apiClient.post).mockImplementation(async url => ({ data: url.includes('cleanup') ? {} : { media_id: 'saved-media', kind, mime_type: kind === 'image' ? 'image/png' : 'audio/wav' } }));
  const onChange = vi.fn();
  await act(async () => root.render(<ContentEditor label="Question" content={{}} text="Draft" subjectId="SUB" onChange={onChange} />));
  const input = container.querySelector(`input[aria-label="Question ${kind}"]`) as HTMLInputElement;
  const file = new File(['media'], kind === 'image' ? 'image.png' : 'audio.wav');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  const request = vi.mocked(apiClient.post).mock.calls.find(([url]) => url.includes('?subject_id='));
  expect(request?.[1]).toBeInstanceOf(FormData);
  expect((request?.[1] as FormData).get('file')).toBe(file);
  expect(request?.[2]).toMatchObject({ timeout: 60000, headers: { 'Content-Type': undefined } });
  expect(onChange).toHaveBeenCalledWith({ [`${kind}_media_id`]: 'saved-media' }, 'Draft');
});

it('retains the draft and shows a retryable upload error', async () => {
  vi.mocked(apiClient.post).mockImplementation(async url => {
    if (url.includes('cleanup')) return { data: {} };
    throw new Error('Unsupported media bytes');
  });
  const onChange = vi.fn();
  await act(async () => root.render(<ContentEditor label="Question" content={{ rich_html: '<p>Draft</p>' }} text="Draft" subjectId="SUB" onChange={onChange} />));
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File(['bad'], 'bad.png')] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(container.querySelector('[role=alert]')?.textContent).toBe('Unsupported media bytes');
  expect(onChange).not.toHaveBeenCalled();
  expect(input.disabled).toBe(false);
});
