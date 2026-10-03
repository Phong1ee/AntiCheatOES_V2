import { useEffect, useRef, useState } from 'react';
import { RichText, sanitizeHTML } from './RichContent';
import './content-editor.css';

const commands = [['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['strikeThrough', 'Strike'], ['superscript', 'Superscript'], ['subscript', 'Subscript'], ['insertOrderedList', 'Ordered list'], ['insertUnorderedList', 'Unordered list'], ['undo', 'Undo'], ['redo', 'Redo'], ['removeFormat', 'Clear formatting']];

/** Native rich editing retains selection/undo. HTML is cleaned on input and paste. */
export function RichEditor({ value, onChange, label, disabled = false }: { value: string; onChange: (html: string) => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const [preview, setPreview] = useState(false);
  const [formula, setFormula] = useState('');
  const [block, setBlock] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const selection = useRef<Range | undefined>(undefined);
  useEffect(() => {
    if (ref.current && (value !== last.current || ref.current.innerHTML === '')) { ref.current.innerHTML = sanitizeHTML(value); last.current = value; }
  }, [value, preview]);
  const publish = () => { const html = sanitizeHTML(ref.current?.innerHTML ?? ''); last.current = html; onChange(html); };
  const command = (name: string, arg?: string) => { ref.current?.focus(); document.execCommand(name, false, arg); publish(); };
  return <div className="rich-editor w-full rounded-lg border bg-white p-2 space-y-2">
    <div className="rich-editor-toolbar flex flex-wrap gap-1" role="toolbar" aria-label={`${label} formatting`}>
      {commands.map(([name, title]) => <button type="button" key={name} data-command={name} aria-label={title} title={title} disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={() => command(name)} className="border rounded px-2 py-1 text-xs focus-visible:ring-2">{title}</button>)}
      <select aria-label="Paragraph style" disabled={disabled || preview} onChange={e => command('formatBlock', e.target.value)} defaultValue="p"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>
      <button type="button" disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={() => { const active = window.getSelection(); const range = active?.rangeCount ? active.getRangeAt(0) : undefined; selection.current = range && ref.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : undefined; setMathOpen(true); }}>Formula</button>
      <button type="button" onClick={() => { setMathOpen(false); setPreview(v => !v); }}>{preview ? 'Edit' : 'Preview'}</button>
    </div>
    {mathOpen && <div className="space-y-2 border p-2"><label>LaTeX<input aria-label="LaTeX formula" maxLength={4000} value={formula} onChange={e => setFormula(e.target.value)} className="w-full border p-2" /></label><label><input type="checkbox" checked={block} onChange={e => setBlock(e.target.checked)} /> Block formula</label><button type="button" disabled={disabled || !formula.trim()} onClick={() => {
      ref.current?.focus(); const selected = window.getSelection();
      if (ref.current) {
        const range = selection.current && ref.current.contains(selection.current.commonAncestorContainer) ? selection.current : document.createRange();
        if (range !== selection.current) { range.selectNodeContents(ref.current); range.collapse(false); }
        selected?.removeAllRanges(); selected?.addRange(range);
      }
      const node = document.createElement(block ? 'div' : 'span'); node.setAttribute('data-math', formula); node.setAttribute('data-display', block ? 'block' : 'inline'); node.textContent = formula;
      document.execCommand('insertHTML', false, node.outerHTML); publish(); setMathOpen(false); setFormula('');
    }}>Insert formula</button><button type="button" onClick={() => setMathOpen(false)}>Cancel</button></div>}
    {preview ? <RichText html={value} /> : <div ref={ref} role="textbox" aria-label={label} aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning className="min-h-24 p-2 outline-none focus:ring-2 focus:ring-teal-500" onInput={publish} onPaste={e => { e.preventDefault(); command('insertHTML', sanitizeHTML(e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain').replaceAll('&', '&amp;').replaceAll('<', '&lt;'))); }} />}
  </div>;
}
