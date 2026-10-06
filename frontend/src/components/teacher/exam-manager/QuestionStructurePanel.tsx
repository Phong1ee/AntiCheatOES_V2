import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api-client';
import type { QuestionBlock } from '../../../types/rich-content';
import type { StudentQuestion } from '../../../types/student-exam';
import { ContentEditor } from '../../common/ContentEditor';
import { RichText } from '../../common/RichContent';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { StudentQuestionPreview } from './StudentQuestionPreview';
import { ArrowDown, ArrowUp, Eye, GripVertical, Layers3, Plus, RotateCcw, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import './QuestionStructurePanel.css';

interface Placement { question_id: number; pinned_position: number | null; pinned_page?: number | null }
interface Structure { version: number; questions_per_page?: number; blocks: QuestionBlock[]; standalone: Placement[]; layout: Array<{ question_id: number; position: number; page: number; slot: number }> }
/** `number` is the question's order in the exam's question list (Q1, Q2, ...). */
export interface StructureQuestionItem { id: number; number: number; text: string; rich_html?: string | null }

export function QuestionStructurePanel({ examId, subjectId, onSaved, revision, questionDirty = false, onDirtyChange, questionItems = [] }: { examId: number; subjectId: string; revision?: number; questionDirty?: boolean; onDirtyChange?: (dirty: boolean) => void; onSaved: () => Promise<void>; questionItems?: StructureQuestionItem[] }) {
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [structure, setStructure] = useState<Structure>();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<StudentQuestion[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [seed, setSeed] = useState('preview-1');
  const [shuffle, setShuffle] = useState(false);
  const [optionShuffle, setOptionShuffle] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pending, setPending] = useState<{ title: string; description: string; label: string; run: () => void } | null>(null);
  const itemById = new Map(questionItems.map(item => [item.id, item]));
  const numberOf = (qid: number) => itemById.get(qid)?.number ?? qid;
  const qref = (qid: number, displayNumber?: string) => {
    const item = itemById.get(qid);
    return <span className="structure-qref"><strong>{displayNumber ?? (item ? `Q${item.number}` : `Question #${qid}`)}</strong>{item && (item.text || item.rich_html) && <span className="structure-qtext"><RichText html={item.rich_html} text={item.text} /></span>}</span>;
  };
  useEffect(() => { if (dirty) return; apiClient.get<Structure>(`/api/teacher/exams/${examId}/question-structure`).then(({ data }) => setStructure(data)).catch(e => setError(String(e))); }, [examId, revision]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const change = (next: Structure) => { setStructure(next); setDirty(true); setPreview([]); };
  const update = (index: number, patch: Partial<QuestionBlock>) => { if (structure) change({ ...structure, blocks: structure.blocks.map((b, i) => i === index ? { ...b, ...patch } : b) }); };
  const reorder = <T,>(items: T[], index: number, delta: number) => { const next = [...items]; const target = index + delta; if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]]; return next; };
  const save = async () => {
    if (!structure) return;
    setBusy(true); setError('');
    try { const { data } = await apiClient.put<{ version: number; layout: Structure['layout'] }>(`/api/teacher/exams/${examId}/question-structure`, { expected_version: structure.version, blocks: structure.blocks, standalone: structure.standalone, questions_per_page: structure.questions_per_page ?? 1 }); setStructure({ ...structure, ...data }); setDirty(false); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Structure could not be saved'); }
    finally { setBusy(false); }
  };
  const loadPreview = async () => {
    if (dirty || questionDirty) { setError('Save structure and question content before previewing.'); return; }
    setBusy(true); setError('');
    try { const { data } = await apiClient.get<{ questions: StudentQuestion[] }>(`/api/teacher/exams/${examId}/question-preview`, { params: { seed, shuffle, shuffle_options: optionShuffle } }); setPreview(data.questions ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Preview failed'); }
    finally { setBusy(false); }
  };
  const reload = async (force = false) => {
    if (dirty && !force) { setPending({ title: 'Reload structure?', description: 'Unsaved structure changes will be discarded.', label: 'Reload', run: () => void reload(true) }); return; }
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.get<Structure>(`/api/teacher/exams/${examId}/question-structure`);
      setStructure(data); setDirty(false); setPreview([]); setSelected([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to reload structure'); }
    finally { setBusy(false); }
  };
  const createBlock = (kind: 'group' | 'parent') => {
    if (!structure) return;
    change({ ...structure, standalone: structure.standalone.filter(p => !selected.includes(p.question_id)), blocks: [...structure.blocks, { kind, title: '', question_ids: selected, keep_order: true, keep_together: true, pinned_position: null, pinned_page: null }] });
    setSelected([]);
  };
  const moveButton = (label: string, disabled: boolean, onClick: () => void, direction: 'up' | 'down') =>
    <Button type="button" variant="outline" size="icon" className="structure-action structure-move" aria-label={label} title={label} disabled={disabled || busy} onClick={onClick}>{direction === 'up' ? <ArrowUp /> : <ArrowDown />}</Button>;

  useEffect(() => { if (previewOpen && !dirty && !questionDirty && !preview.length) void loadPreview(); }, [previewOpen]);

  return <>
  <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <div className="question-structure-launcher">
      <Button type="button" variant="outline" className="structure-action" onClick={() => setOpen(true)}><Layers3 />Manage question groups</Button>
      <span className="structure-summary">{structure ? `${structure.blocks.length} group${structure.blocks.length === 1 ? '' : 's'} · ${structure.standalone.length} ungrouped question${structure.standalone.length === 1 ? '' : 's'}` : 'Groups, reading passages & page order'}</span>
      {dirty && <span className="structure-draft" role="status">Unsaved structure · draft retained</span>}
      <Button type="button" variant="link" className="structure-preview-link" onClick={() => setPreviewOpen(true)}><Eye />Student preview</Button>
    </div>
    <DialogContent className="question-structure-dialog oes-dialog-rounded" onInteractOutside={e => { if (busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader className="structure-modal-header">
        <DialogTitle>Question groups & display order</DialogTitle>
        <DialogDescription>Keep related questions together, add a shared reading passage, and choose which page each question appears on. Closing this window keeps your unsaved changes.</DialogDescription>
      </DialogHeader>
      <nav className="structure-tabs" aria-label="Question group tools">
        <button type="button" aria-pressed="true"><Layers3 size={16} />Groups & page order</button>
        <button type="button" aria-pressed="false" onClick={() => { setOpen(false); setPreviewOpen(true); }}><Eye size={16} />Student preview (opens a larger window)</button>
      </nav>
      <div className="structure-modal-body">
        {questionDirty && <p className="structure-notice" role="status">Save question and pool changes before saving structure or previewing.</p>}
        {error && <p role="alert" className="structure-error">{error}</p>}
        {!structure ? <div role="status">{error ? <Button type="button" variant="outline" className="structure-action" onClick={() => void reload()}>Retry loading</Button> : 'Loading question structure…'}</div> : <>
          <div className="structure-section-heading"><div><h3>Groups</h3><p>A group keeps questions together. A parent passage adds shared text (for example a reading) above its sub-questions; the passage itself is not scored.</p></div><Button type="button" variant="outline" size="sm" className="structure-action" disabled={busy} onClick={() => void reload()}><RotateCcw />Reload structure</Button></div>
          {!structure.blocks.length && <div className="structure-empty"><Layers3 size={24} /><div><strong>No groups yet</strong><p>Tick questions under "Ungrouped questions" below, then create a group or a parent passage.</p></div></div>}
          {structure.blocks.map((block, index) => <fieldset key={block.block_id ?? `new-${index}`} className="structure-block">
            <legend>{block.kind === 'parent' ? `Parent passage ${index + 1}` : `Question Group ${index + 1}`}</legend>
            <div className="structure-block-heading"><label className="structure-field">Title<input placeholder={block.kind === 'parent' ? 'Parent passage title' : 'Group title'} value={block.title} onChange={e => update(index, { title: e.target.value })} /></label><div className="structure-row-actions">{moveButton('Move block up', index === 0, () => change({ ...structure, blocks: reorder(structure.blocks, index, -1) }), 'up')}{moveButton('Move block down', index === structure.blocks.length - 1, () => change({ ...structure, blocks: reorder(structure.blocks, index, 1) }), 'down')}<Button type="button" variant="link" className="structure-remove" onClick={() => setPending({ title: 'Remove this container?', description: 'Its questions are detached and stay in the exam as ungrouped questions.', label: 'Remove container', run: () => change({ ...structure, blocks: structure.blocks.filter((_, i) => i !== index), standalone: [...structure.standalone, ...block.question_ids.map(question_id => ({ question_id, pinned_position: null }))] }) })}>Remove container</Button></div></div>
            <ContentEditor label={`${block.kind} instructions`} content={block} text="" subjectId={subjectId} disabled={busy} onChange={content => update(index, content)} />
            <div className="structure-block-settings"><label className="structure-check"><input type="checkbox" checked={block.keep_order} onChange={e => update(index, { keep_order: e.target.checked })} />Keep question order</label><label className="structure-check"><input type="checkbox" checked={block.keep_together} onChange={e => update(index, { keep_together: e.target.checked })} />Keep together when it fits a page</label><label className="structure-field structure-pin">Show on page<input aria-label={`Block ${index + 1} pin`} type="number" min={1} placeholder="Automatic" value={block.pinned_page ?? ''} onChange={e => update(index, { pinned_page: e.target.value ? Number(e.target.value) : null, pinned_position: null })} /></label></div>
              <div className="structure-block-settings"><label className="structure-check"><input type="checkbox" checked={block.keep_order} onChange={e => update(index, { keep_order: e.target.checked })} />Keep question order</label><label className="structure-check"><input type="checkbox" checked={block.keep_together} onChange={e => update(index, { keep_together: e.target.checked })} />Keep all questions on one page (students scroll)</label><label className="structure-field structure-pin">Show on page<input aria-label={`Block ${index + 1} pin`} type="number" min={1} placeholder="Automatic" value={block.pinned_page ?? ''} onChange={e => update(index, { pinned_page: e.target.value ? Number(e.target.value) : null, pinned_position: null })} /></label></div>
            <div className="structure-question-list">{block.question_ids.map((qid, child) => <div key={qid} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(child))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); const next = [...block.question_ids]; if (Number.isInteger(from) && from >= 0 && from < next.length) { const [id] = next.splice(from, 1); next.splice(child, 0, id); update(index, { question_ids: next }); } }} className="structure-question-row">
              <GripVertical size={16} className="structure-grip" aria-label="Drag to reorder" /><span className="structure-question-name">{qref(qid, `${index + 1}.${child + 1}`)}</span><div className="structure-row-actions">{moveButton(`Move question ${numberOf(qid)} up`, child === 0, () => update(index, { question_ids: reorder(block.question_ids, child, -1) }), 'up')}{moveButton(`Move question ${numberOf(qid)} down`, child === block.question_ids.length - 1, () => update(index, { question_ids: reorder(block.question_ids, child, 1) }), 'down')}<Button type="button" variant="link" className="structure-preview-link" disabled={block.question_ids.length === 1} onClick={() => change({ ...structure, blocks: structure.blocks.map((b, i) => i === index ? { ...b, question_ids: b.question_ids.filter(q => q !== qid) } : b), standalone: [...structure.standalone, { question_id: qid, pinned_position: null, pinned_page: null }] })}>Detach</Button></div>
            </div>)}</div>
            <label className="structure-field">Add a question<select aria-label={`Add question to block ${index + 1}`} value="" disabled={!structure.standalone.length} onChange={e => { const qid = Number(e.target.value); if (!qid) return; change({ ...structure, standalone: structure.standalone.filter(p => p.question_id !== qid), blocks: structure.blocks.map((b, i) => i === index ? { ...b, question_ids: [...b.question_ids, qid] } : b) }); }}><option value="">Add an ungrouped question…</option>{structure.standalone.map(p => <option key={p.question_id} value={p.question_id}>{itemById.has(p.question_id) ? `Q${numberOf(p.question_id)}` : `Question #${p.question_id}`}</option>)}</select></label>
          </fieldset>)}
          <section className="structure-standalone"><div className="structure-section-heading"><div><h3>Page layout</h3><p>Questions without a page number fill pages in order, this many per page. Questions given the same page number stay together.</p></div><label className="structure-field structure-perpage">Questions per page (1-50)<input aria-label="Questions per page" type="number" min={1} max={50} value={structure.questions_per_page ?? 1} onChange={e => change({ ...structure, questions_per_page: Number(e.target.value) })} /></label></div></section>
          <section className="structure-standalone"><div className="structure-section-heading"><div><h3>Ungrouped questions</h3><p>Tick questions to put them in a group or a parent passage. Use the arrows to change their order and the page box to fix a question to a page.</p></div><span className="structure-summary">{selected.length} selected</span></div>
            {!structure.standalone.length && <p className="structure-empty">Every question is in a group. Detach a question from its group to list it here.</p>}
            {structure.standalone.map((p, index) => <div key={p.question_id} className="structure-question-row"><label className="structure-check structure-question-name"><input type="checkbox" aria-label={`Select ${itemById.has(p.question_id) ? `Q${numberOf(p.question_id)}` : `question ${p.question_id}`}`} checked={selected.includes(p.question_id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.question_id] : ids.filter(id => id !== p.question_id))} />{qref(p.question_id)}</label><div className="structure-row-actions">{moveButton(`Move question ${numberOf(p.question_id)} up`, index === 0, () => change({ ...structure, standalone: reorder(structure.standalone, index, -1) }), 'up')}{moveButton(`Move question ${numberOf(p.question_id)} down`, index === structure.standalone.length - 1, () => change({ ...structure, standalone: reorder(structure.standalone, index, 1) }), 'down')}<label className="structure-inline-pin">Page<input aria-label={`Question ${numberOf(p.question_id)} pin`} type="number" min={1} placeholder="Auto" value={p.pinned_page ?? ''} onChange={e => change({ ...structure, standalone: structure.standalone.map((r, i) => i === index ? { ...r, pinned_page: e.target.value ? Number(e.target.value) : null, pinned_position: null } : r) })} /></label></div></div>)}
            <div className="structure-create-actions"><Button type="button" variant="outline" className="structure-action" disabled={!selected.length || busy} onClick={() => createBlock('group')}><Plus />Create group from selected</Button><Button type="button" variant="outline" className="structure-action" disabled={!selected.length || busy} onClick={() => createBlock('parent')}><Plus />Create parent passage from selected</Button></div>
          </section>
          <section className="structure-positions"><h3>Order students will see</h3><p>Updated after you save. Page and position start at 1.</p><div className="structure-position-grid">{[...structure.layout].sort((a, b) => a.position - b.position).map(l => <div key={l.question_id}><span className="structure-position-badge">{l.position}</span>{qref(l.question_id)}<span className="structure-position-page">Page {l.page}</span></div>)}</div></section>
        </>}
      </div>
      <div className="structure-modal-footer"><span role="status">{dirty ? 'Unsaved structure changes are kept when you close.' : 'Structure is up to date.'}</span><div className="structure-row-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Close</Button><Button type="button" className="structure-primary" disabled={!structure || !dirty || busy || questionDirty} onClick={() => void save()}><Save />{busy ? 'Please wait…' : 'Save structure'}</Button></div></div>
    </DialogContent>
    <ConfirmDialog open={pending !== null} title={pending?.title ?? ''} description={pending?.description ?? ''} confirmLabel={pending?.label} destructive onCancel={() => setPending(null)} onConfirm={() => { pending?.run(); setPending(null); }} />
  </Dialog>
  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
    <DialogContent className="student-preview-dialog oes-dialog-rounded">
      <DialogHeader className="structure-modal-header">
        <DialogTitle>Student preview</DialogTitle>
        <DialogDescription>The saved exam as students will see it. The random seed makes shuffled results repeatable.</DialogDescription>
      </DialogHeader>
      <div className="structure-preview-controls structure-preview-bar"><label className="structure-field">Random seed<input value={seed} onChange={e => setSeed(e.target.value)} /></label><label className="structure-check"><input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />Shuffle questions</label><label className="structure-check"><input type="checkbox" checked={optionShuffle} onChange={e => setOptionShuffle(e.target.checked)} />Shuffle options</label><label className="structure-check"><input type="checkbox" checked={mobile} onChange={e => setMobile(e.target.checked)} />Phone width</label><Button type="button" className="structure-primary structure-preview-load" disabled={busy || dirty || questionDirty} onClick={() => void loadPreview()}><Eye />Preview saved exam</Button></div>
      <div className="structure-modal-body">
        {(questionDirty || dirty) && <p className="structure-notice" role="status">{questionDirty ? 'Save question and pool changes before saving structure or previewing.' : 'Save your structure changes before previewing.'}</p>}
        {error && <p role="alert" className="structure-error">{error}</p>}
        {preview.length > 0 ? <StudentQuestionPreview questions={preview} mobile={mobile} /> : <div className="structure-empty"><Eye size={24} /><p>{busy ? 'Loading preview…' : 'Save your changes, then load the student preview.'}</p></div>}
      </div>
      <div className="structure-modal-footer"><span /><Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button></div>
    </DialogContent>
  </Dialog>
  </>;
}
