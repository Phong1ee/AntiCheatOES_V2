import { useState } from 'react';
import type { RichContent as Content } from '../../types/rich-content';
import { RichEditor } from './RichEditor';
import { RichContent, richPlain } from './RichContent';
import { apiClient } from '../../services/api-client';

export function ContentEditor({ content, text, subjectId, label, disabled, onChange }: { content: Content; text: string; subjectId: string; label: string; disabled?: boolean; onChange: (content: Content, text: string) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [progress, setProgress] = useState(0);
  const upload = async (file: File, kind: 'image' | 'audio') => {
    setBusy(true); setError(''); setProgress(0);
    // A delayed sweep retains bytes needed by retryable failed saves.
    void apiClient.post('/api/teacher/question-media/cleanup-staged').catch(() => undefined);
    const form = new FormData(); form.append('file', file);
    try {
      const { data } = await apiClient.post<{ media_id: string; kind: string; mime_type: string }>(`/api/teacher/question-media?subject_id=${encodeURIComponent(subjectId)}`, form, { onUploadProgress: e => setProgress(e.total ? Math.round(e.loaded / e.total * 100) : 0) });
      if (data.kind !== kind) throw new Error(`Choose a valid ${kind} file.`);
      if (kind === 'audio' && !document.createElement('audio').canPlayType(data.mime_type)) throw new Error('This browser cannot play this audio format. Use MP3 or WAV.');
      onChange({ ...content, [`${kind}_media_id`]: data.media_id }, text);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed; choose the file again to retry.'); }
    finally { setBusy(false); }
  };
  const html = content.rich_html ?? text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '<br>');
  return <div className="w-full min-w-0 space-y-2">
    <RichEditor label={label} value={html} disabled={disabled || busy} onChange={rich_html => onChange({ ...content, rich_html }, richPlain(rich_html))} />
    <div className="content-media-actions">{(['image', 'audio'] as const).map(kind => <div key={kind} className="content-media-action"><label className="content-media-upload" aria-disabled={Boolean(disabled || busy || !subjectId)}>{content[`${kind}_media_id`] ? 'Replace' : 'Add'} {kind}<input className="content-media-file" aria-label={`${label} ${kind}`} type="file" disabled={disabled || busy || !subjectId} accept={kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a'} onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0], kind); e.target.value = ''; }} /></label>{content[`${kind}_media_id`] && <button type="button" className="content-media-remove" disabled={disabled || busy} onClick={() => { if (window.confirm(`Remove ${kind} from this item?`)) onChange({ ...content, [`${kind}_media_id`]: null }, text); }}>Remove {kind}</button>}</div>)}</div>
    {content.image_media_id && <label className="block text-sm">Image description<input aria-label={`${label} image description`} className="w-full border rounded p-2" value={content.image_alt ?? ''} disabled={disabled} onChange={e => onChange({ ...content, image_alt: e.target.value }, text)} /></label>}
    {busy && <p role="status">Uploading… {progress}%</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    <RichContent content={{ ...content, rich_html: '' }} />
  </div>;
}
