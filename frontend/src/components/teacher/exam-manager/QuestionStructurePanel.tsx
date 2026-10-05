import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api-client';
import type { QuestionBlock } from '../../../types/rich-content';
import type { StudentQuestion } from '../../../types/student-exam';
import { ContentEditor } from '../../common/ContentEditor';
import { StudentQuestionPreview } from './StudentQuestionPreview';
import { ArrowDown, ArrowUp, Eye, GripVertical, Layers3, Plus, RotateCcw, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import './QuestionStructurePanel.css';

interface Placement { question_id: number; pinned_position: number | null; pinned_page?: number | null }
interface Structure { version: number; questions_per_page?: number; blocks: QuestionBlock[]; standalone: Placement[]; layout: Array<{ question_id: number; position: number; page: number; slot: number }> }

export function QuestionStructurePanel({ examId, subjectId, onSaved, revision, questionDirty = false, onDirtyChange }: { examId: number; subjectId: string; revision?: number; questionDirty?: boolean; onDirtyChange?: (dirty: boolean) => void; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'structure' | 'preview'>('structure');
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
    try { const { data } = await apiClient.get<{ questions: StudentQuestion[] }>(`/api/teacher/exams/${examId}/question-preview`, { params: { seed, shuffle, shuffle_options: optionShuffle } }); setPreview(data.questions); }
    catch (e) { setError(e instanceof Error ? e.message : 'Preview failed'); }
    finally { setBusy(false); }
  };
  const reload = async () => {
    if (dirty && !window.confirm('Reload structure? Unsaved structure changes will be discarded.')) return;
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

  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <div className="question-structure-launcher">
      <Button type="button" variant="outline" className="structure-action" onClick={() => { setSection('structure'); setOpen(true); }}><Layers3 />Manage question groups</Button>
      <span className="structure-summary">{structure ? `${structure.blocks.length} blocks · ${structure.standalone.length} standalone questions` : 'Groups, parent passages & positions'}</span>
      {dirty && <span className="structure-draft" role="status">Unsaved structure · draft retained</span>}
      <Button type="button" variant="link" className="structure-preview-link" onClick={() => { setSection('preview'); setOpen(true); }}><Eye />Student preview</Button>
    </div>
    <DialogContent className="question-structure-dialog oes-dialog-rounded" onInteractOutside={e => { if (busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader className="structure-modal-header">
        <DialogTitle>Question groups & display order</DialogTitle>
        <DialogDescription>Organize groups, parent passages and pinned positions. Your question editor stays in place when you close this window.</DialogDescription>
      </DialogHeader>
      <nav className="structure-tabs" aria-label="Question group tools">
        <button type="button" aria-pressed={section === 'structure'} onClick={() => setSection('structure')}><Layers3 size={16} />Groups & positions</button>
        <button type="button" aria-pressed={section === 'preview'} onClick={() => setSection('preview')}><Eye size={16} />Student preview</button>
      </nav>
      <div className="structure-modal-body">
        {questionDirty && <p className="structure-notice" role="status">Save question and pool changes before saving structure or previewing.</p>}
        {error && <p role="alert" className="structure-error">{error}</p>}
        {!structure ? <div role="status">{error ? <Button type="button" variant="outline" className="structure-action" onClick={() => void reload()}>Retry loading</Button> : 'Loading question structure…'}</div> : section === 'structure' ? <>
          <div className="structure-section-heading"><div><h3>Groups & parent passages</h3><p>A passage or group header does not count as an answer.</p></div><Button type="button" variant="outline" size="sm" className="structure-action" disabled={busy} onClick={() => void reload()}><RotateCcw />Reload structure</Button></div>
          {!structure.blocks.length && <div className="structure-empty"><Layers3 size={24} /><div><strong>No groups yet</strong><p>Select standalone questions below, then create a group or parent passage.</p></div></div>}
          {structure.blocks.map((block, index) => <fieldset key={block.block_id ?? `new-${index}`} className="structure-block">
            <legend>{block.kind === 'parent' ? 'Parent / sub-question block' : 'Question group'} {index + 1}</legend>
            <div className="structure-block-heading"><label className="structure-field">Title<input placeholder={block.kind === 'parent' ? 'Parent passage title' : 'Group title'} value={block.title} onChange={e => update(index, { title: e.target.value })} /></label><div className="structure-row-actions">{moveButton('Move block up', index === 0, () => change({ ...structure, blocks: reorder(structure.blocks, index, -1) }), 'up')}{moveButton('Move block down', index === structure.blocks.length - 1, () => change({ ...structure, blocks: reorder(structure.blocks, index, 1) }), 'down')}<Button type="button" variant="link" className="structure-remove" onClick={() => { if (window.confirm('Remove this container and detach its children? The questions remain in the exam.')) change({ ...structure, blocks: structure.blocks.filter((_, i) => i !== index), standalone: [...structure.standalone, ...block.question_ids.map(question_id => ({ question_id, pinned_position: null }))] }); }}>Remove container</Button></div></div>
            <ContentEditor label={`${block.kind} instructions`} content={block} text="" subjectId={subjectId} disabled={busy} onChange={content => update(index, content)} />
            <div className="structure-block-settings"><label className="structure-check"><input type="checkbox" checked={block.keep_order} onChange={e => update(index, { keep_order: e.target.checked })} />Keep question order</label><label className="structure-check"><input type="checkbox" checked={block.keep_together} onChange={e => update(index, { keep_together: e.target.checked })} />Keep together when it fits a page</label><label className="structure-field structure-pin">Pin to page<input aria-label={`Block ${index + 1} pin`} type="number" min={1} placeholder="Not pinned" value={block.pinned_page ?? ''} onChange={e => update(index, { pinned_page: e.target.value ? Number(e.target.value) : null, pinned_position: null })} /></label></div>
            <div className="structure-question-list">{block.question_ids.map((qid, child) => <div key={qid} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(child))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); const next = [...block.question_ids]; if (Number.isInteger(from) && from >= 0 && from < next.length) { const [id] = next.splice(from, 1); next.splice(child, 0, id); update(index, { question_ids: next }); } }} className="structure-question-row">
              <GripVertical size={16} className="structure-grip" aria-label="Drag to reorder" /><span className="structure-question-name">{block.kind === 'parent' ? 'Sub-question' : 'Question'} #{qid}</span><div className="structure-row-actions">{moveButton(`Move question ${qid} up`, child === 0, () => update(index, { question_ids: reorder(block.question_ids, child, -1) }), 'up')}{moveButton(`Move question ${qid} down`, child === block.question_ids.length - 1, () => update(index, { question_ids: reorder(block.question_ids, child, 1) }), 'down')}<Button type="button" variant="link" className="structure-preview-link" disabled={block.question_ids.length === 1} onClick={() => change({ ...structure, blocks: structure.blocks.map((b, i) => i === index ? { ...b, question_ids: b.question_ids.filter(q => q !== qid) } : b), standalone: [...structure.standalone, { question_id: qid, pinned_position: null, pinned_page: null }] })}>Detach</Button></div>
            </div>)}</div>
            <label className="structure-field">Add a question<select aria-label={`Add question to block ${index + 1}`} value="" disabled={!structure.standalone.length} onChange={e => { const qid = Number(e.target.value); if (!qid) return; change({ ...structure, standalone: structure.standalone.filter(p => p.question_id !== qid), blocks: structure.blocks.map((b, i) => i === index ? { ...b, question_ids: [...b.question_ids, qid] } : b) }); }}><option value="">Add standalone question…</option>{structure.standalone.map(p => <option key={p.question_id} value={p.question_id}>Question #{p.question_id}</option>)}</select></label>
          </fieldset>)}
          <section className="structure-standalone"><label className="structure-field">Questions per page (1-50)<input aria-label="Questions per page" type="number" min={1} max={50} value={structure.questions_per_page ?? 1} onChange={e => change({ ...structure, questions_per_page: Number(e.target.value) })} /></label><p>Default for unpinned questions. Questions pinned to the same page stay together.</p><div className="structure-section-heading"><div><h3>Standalone questions</h3><p>Select questions to put them in a group or parent block.</p></div><span className="structure-summary">{selected.length} selected</span></div>
            {!structure.standalone.length && <p className="structure-empty">All questions are in blocks. Detach a question to move it here.</p>}
            {structure.standalone.map((p, index) => <div key={p.question_id} className="structure-question-row"><label className="structure-check structure-question-name"><input type="checkbox" checked={selected.includes(p.question_id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.question_id] : ids.filter(id => id !== p.question_id))} />Question #{p.question_id}</label><div className="structure-row-actions">{moveButton(`Move standalone question ${p.question_id} up`, index === 0, () => change({ ...structure, standalone: reorder(structure.standalone, index, -1) }), 'up')}{moveButton(`Move standalone question ${p.question_id} down`, index === structure.standalone.length - 1, () => change({ ...structure, standalone: reorder(structure.standalone, index, 1) }), 'down')}<label className="structure-inline-pin">Pin to page<input aria-label={`Question ${p.question_id} pin`} type="number" min={1} placeholder="—" value={p.pinned_page ?? ''} onChange={e => change({ ...structure, standalone: structure.standalone.map((r, i) => i === index ? { ...r, pinned_page: e.target.value ? Number(e.target.value) : null, pinned_position: null } : r) })} /></label></div></div>)}
            <div className="structure-create-actions"><Button type="button" variant="outline" className="structure-action" disabled={!selected.length || busy} onClick={() => createBlock('group')}><Plus />Create group from selected</Button><Button type="button" variant="outline" className="structure-action" disabled={!selected.length || busy} onClick={() => createBlock('parent')}><Plus />Create parent from selected</Button></div>
          </section>
          <section className="structure-positions"><h3>Saved display positions</h3><p>Positions start at 1. Changes appear here after saving.</p><div className="structure-position-grid">{structure.layout.map(l => <div key={l.question_id}><strong>Question #{l.question_id}</strong><span>Position {l.position} · Page {l.page} / Slot {l.slot}</span></div>)}</div></section>
        </> : <section className="structure-preview-section"><div className="structure-section-heading"><div><h3>Student preview</h3><p>Preview saved content with a repeatable seed and screen width.</p></div></div><div className="structure-preview-controls"><label className="structure-field">Seed<input value={seed} onChange={e => setSeed(e.target.value)} /></label><label className="structure-check"><input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />Shuffle questions</label><label className="structure-check"><input type="checkbox" checked={optionShuffle} onChange={e => setOptionShuffle(e.target.checked)} />Shuffle options</label><label className="structure-check"><input type="checkbox" checked={mobile} onChange={e => setMobile(e.target.checked)} />Mobile width</label></div><Button type="button" className="structure-primary" disabled={busy || dirty || questionDirty} onClick={() => void loadPreview()}><Eye />Preview saved exam</Button>{preview.length > 0 ? <StudentQuestionPreview questions={preview} mobile={mobile} /> : <div className="structure-empty"><Eye size={24} /><p>Save your changes, then load the student preview.</p></div>}</section>}
      </div>
      <div className="structure-modal-footer"><span role="status">{dirty ? 'Unsaved structure changes are kept when you close.' : 'Structure is up to date.'}</span><div className="structure-row-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Close</Button><Button type="button" className="structure-primary" disabled={!structure || !dirty || busy || questionDirty} onClick={() => void save()}><Save />{busy ? 'Please wait…' : 'Save structure'}</Button></div></div>
    </DialogContent>
  </Dialog>;
}
