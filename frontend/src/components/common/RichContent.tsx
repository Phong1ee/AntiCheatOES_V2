import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { RichContent as Content } from '../../types/rich-content';
import { apiClient } from '../../services/api-client';

const tags = new Set(['p', 'br', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'sup', 'sub', 'span']);
const drop = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'img', 'input', 'link', 'meta']);

/** Rebuild from an allowlist. No user HTML reaches React's HTML sink. */
export function sanitizeHTML(html: string): string {
  const document = new DOMParser().parseFromString(html.slice(0, 60000), 'text/html');
  const clean = (node: Node, depth = 0): Node | null => {
    if (depth >= 100) return null;
    if (node.nodeType === 3) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof Element) || drop.has(node.tagName.toLowerCase())) return null;
    const tag = node.tagName.toLowerCase();
    const result = document.createElement(tags.has(tag) ? tag : 'span');
    if (['div', 'span'].includes(tag) && node.hasAttribute('data-math')) {
      const source = (node.getAttribute('data-math') ?? '').slice(0, 4000);
      result.setAttribute('data-math', source);
      result.setAttribute('data-display', node.getAttribute('data-display') === 'block' ? 'block' : 'inline');
      // Rendered KaTeX markup inside the editor must not be persisted.
      result.textContent = source;
      return result;
    }
    for (const child of node.childNodes) { const safe = clean(child, depth + 1); if (safe) result.appendChild(safe); }
    return result;
  };
  const container = document.createElement('div');
  for (const child of document.body.childNodes) { const safe = clean(child); if (safe) container.appendChild(safe); }
  return container.innerHTML;
}

export function richPlain(html: string): string {
  const document = new DOMParser().parseFromString(sanitizeHTML(html), 'text/html');
  document.querySelectorAll('[data-math]').forEach(node => { node.textContent = node.getAttribute('data-math'); });
  return document.body.textContent?.trim() ?? '';
}

/** Show formulas as typeset, atomic (non-editable) chips inside the editing surface. */
export function renderEditorMath(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-math]').forEach(el => {
    const source = el.getAttribute('data-math') ?? '';
    const block = el.getAttribute('data-display') === 'block';
    const key = `${block}:${source}`;
    if (el.dataset.rendered === key) return;
    el.contentEditable = 'false';
    try {
      katex.render(source, el, { displayMode: block, trust: false, strict: 'error', throwOnError: true, maxExpand: 200, maxSize: 20 });
      el.classList.remove('rich-math-error');
    } catch { el.textContent = source; el.classList.add('rich-math-error'); }
    el.dataset.rendered = key;
  });
}

export function MathFormula({ source, block }: { source: string; block: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    try {
      if (ref.current) katex.render(source, ref.current, { displayMode: block, trust: false, strict: 'error', throwOnError: true, maxExpand: 200, maxSize: 20 });
    } catch { setError(true); }
  }, [source, block]);
  return <span className={block ? 'block overflow-x-auto' : ''}><span ref={ref} aria-label={source} hidden={error} />{error && <span role="status" className="text-red-700">Invalid formula: {source}</span>}</span>;
}

export function RichText({ html, text = '' }: { html?: string | null; text?: string }) {
  if (html == null) return <div className="whitespace-pre-wrap break-words">{text}</div>;
  const document = new DOMParser().parseFromString(sanitizeHTML(html), 'text/html');
  const render = (node: Node, key: number): ReactNode => {
    if (node.nodeType === 3) return node.textContent;
    if (!(node instanceof Element)) return null;
    if (node.hasAttribute('data-math')) return <MathFormula key={key} source={node.getAttribute('data-math') ?? ''} block={node.getAttribute('data-display') === 'block'} />;
    return createElement(node.tagName.toLowerCase(), { key }, ...Array.from(node.childNodes).map(render));
  };
  return <div className="rich-content break-words [&_ol]:list-decimal [&_ul]:list-disc [&_li]:ml-6 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_p]:mb-2">{Array.from(document.body.childNodes).map(render)}</div>;
}

export function MediaPlayer({ id, kind, alt, attemptId }: { id: string; kind: 'image' | 'audio'; alt: string; attemptId?: number }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stopped = false; let created: string | undefined;
    setUrl(undefined); setFailed(false); setLoading(true);
    const path = attemptId ? `/api/exams/attempts/${attemptId}/media/${id}` : `/api/teacher/question-media/${id}`;
    apiClient.get(path, { responseType: 'blob' }).then(({ data }) => {
      if (stopped) return;
      created = URL.createObjectURL(data as Blob); setUrl(created);
    }).catch(() => { if (!stopped) { setFailed(true); setLoading(false); } });
    return () => { stopped = true; if (created) URL.revokeObjectURL(created); };
  }, [id, attemptId, retry]);
  return <div className="my-3 max-w-full" onClick={e => e.stopPropagation()}>
    {loading && !failed && <span role="status">Loading {kind}…</span>}
    {failed && <div role="alert">Unable to load {kind}. <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
    {url && (kind === 'image' ? <img src={url} alt={alt || 'Question image'} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} className="max-h-80 max-w-full object-contain rounded-lg" /> : <audio controls preload="metadata" src={url} aria-label={alt || 'Question audio'} onLoadedMetadata={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} className="w-full max-w-full" />)}
  </div>;
}

export function RichContent({ content, text = '', attemptId }: { content: Content; text?: string; attemptId?: number }) {
  return <div className="min-w-0"><RichText html={content.rich_html} text={text} />{content.image_media_id && <MediaPlayer id={content.image_media_id} kind="image" alt={content.image_alt ?? 'Question image'} attemptId={attemptId} />}{content.audio_media_id && <MediaPlayer id={content.audio_media_id} kind="audio" alt="Question audio" attemptId={attemptId} />}</div>;
}
