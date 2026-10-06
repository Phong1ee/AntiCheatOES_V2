import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Eye, Italic, List, ListOrdered, Pencil, Redo2, RemoveFormatting, Sigma, Strikethrough, Subscript, Superscript, Underline, Undo2 } from 'lucide-react';
import { RichText, sanitizeHTML } from './RichContent';
import './content-editor.css';

const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true };
type Command = [name: string, title: string, glyph: ReactNode];
const commandGroups: Command[][] = [
  [['undo', 'Undo', <Undo2 {...icon} />], ['redo', 'Redo', <Redo2 {...icon} />]],
  [['bold', 'Bold', <Bold {...icon} />], ['italic', 'Italic', <Italic {...icon} />], ['underline', 'Underline', <Underline {...icon} />], ['strikeThrough', 'Strike', <Strikethrough {...icon} />]],
  [['superscript', 'Superscript', <Superscript {...icon} />], ['subscript', 'Subscript', <Subscript {...icon} />]],
  [['insertUnorderedList', 'Unordered list', <List {...icon} />], ['insertOrderedList', 'Ordered list', <ListOrdered {...icon} />]],
  [['removeFormat', 'Clear formatting', <RemoveFormatting {...icon} />]],
];

/** Native rich editing retains selection/undo. HTML is cleaned on input and paste. */
export function RichEditor({ value, onChange, label, disabled = false, compact = false }: { value: string; onChange: (html: string) => void; label: string; disabled?: boolean; compact?: boolean }) {
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
  return <div className={`rich-editor w-full bg-white${compact ? ' rich-editor-compact' : ''}`}>
    <div className="rich-editor-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {commandGroups.slice(0, 1).map(group => compact ? null : <div className="rich-editor-group" role="group" key={group[0][0]}>{group.map(([name, title, glyph]) => <button type="button" key={name} data-command={name} aria-label={title} title={title} disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={() => command(name)}>{glyph}</button>)}</div>)}
      {!compact && <select aria-label="Paragraph style" disabled={disabled || preview} onChange={e => command('formatBlock', e.target.value)} defaultValue="p"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>}
      {commandGroups.slice(1).map(group => compact && !['bold', 'superscript'].includes(group[0][0]) ? null : <div className="rich-editor-group" role="group" key={group[0][0]}>{group.map(([name, title, glyph]) => <button type="button" key={name} data-command={name} aria-label={title} title={title} disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={() => command(name)}>{glyph}</button>)}</div>)}
      <div className="rich-editor-group rich-editor-actions">
        <button type="button" className="with-label" aria-label="Formula" title="Insert formula" disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={() => { const active = window.getSelection(); const range = active?.rangeCount ? active.getRangeAt(0) : undefined; selection.current = range && ref.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : undefined; setMathOpen(true); }}><Sigma {...icon} /></button>
        {!compact && <button type="button" className="with-label" onClick={() => { setMathOpen(false); setPreview(v => !v); }}>{preview ? <Pencil {...icon} /> : <Eye {...icon} />}{preview ? 'Edit' : 'Preview'}</button>}
      </div>
    </div>
    {mathOpen && <div className="rich-formula-panel"><label className="rich-formula-field"><span>LaTeX formula</span><input aria-label="LaTeX formula" placeholder="e.g. x^2 + y^2 = z^2" maxLength={4000} value={formula} onChange={e => setFormula(e.target.value)} /></label><div className="rich-formula-footer"><label className="rich-formula-check"><input type="checkbox" checked={block} onChange={e => setBlock(e.target.checked)} />Block formula (own line)</label><div className="rich-formula-buttons"><button type="button" className="rich-formula-cancel" onClick={() => setMathOpen(false)}>Cancel</button><button type="button" className="rich-formula-insert" disabled={disabled || !formula.trim()} onClick={() => {
      ref.current?.focus(); const selected = window.getSelection();
      if (ref.current) {
        const range = selection.current && ref.current.contains(selection.current.commonAncestorContainer) ? selection.current : document.createRange();
        if (range !== selection.current) { range.selectNodeContents(ref.current); range.collapse(false); }
        selected?.removeAllRanges(); selected?.addRange(range);
      }
      const node = document.createElement(block ? 'div' : 'span'); node.setAttribute('data-math', formula); node.setAttribute('data-display', block ? 'block' : 'inline'); node.textContent = formula;
      document.execCommand('insertHTML', false, node.outerHTML); publish(); setMathOpen(false); setFormula('');
    }}>Insert formula</button></div></div></div>}
    {preview ? <div className="min-h-24 p-3"><RichText html={value} /></div> : <div ref={ref} role="textbox" aria-label={label} aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning className="min-h-24 outline-none" onInput={publish} onPaste={e => { e.preventDefault(); command('insertHTML', sanitizeHTML(e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain').replaceAll('&', '&amp;').replaceAll('<', '&lt;'))); }} />}
  </div>;
}
