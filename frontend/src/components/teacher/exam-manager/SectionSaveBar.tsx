import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';

import { Button } from '../../ui/button';

interface SectionSaveBarProps {
  /** Consistent per-section wording, e.g. "Save Settings". */
  label: string;
  dirty: boolean;
  saving: boolean;
  /** Timestamp of the last successful save, or null when nothing was saved yet. */
  savedAt: number | null;
  error?: string | null;
  /** Extra gate (failed validation) that keeps the button disabled while still dirty. */
  saveDisabled?: boolean;
  /** Left-hand summary such as counts; rendered above the status line. */
  summary?: ReactNode;
  onSave: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
}

/**
 * Shared footer for every editor section so the save affordance sits in the same
 * place with the same states (unsaved / saving / saved / failed) everywhere.
 */
export function SectionSaveBar({
  label,
  dirty,
  saving,
  savedAt,
  error = null,
  saveDisabled = false,
  summary,
  onSave,
  onDiscard,
  discardLabel = 'Discard changes',
}: SectionSaveBarProps) {
  // "Saved" is only claimed for a request that actually succeeded and has not
  // been superseded by newer edits.
  const showSaved = savedAt !== null && !dirty && !error && !saving;

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
        {summary && <div className="text-gray-600">{summary}</div>}
        <div aria-live="polite" className="flex items-center gap-1.5 text-xs">
          {saving ? (
            <span className="flex items-center gap-1.5 text-gray-500"><Loader2 className="size-3.5 animate-spin" />Saving...</span>
          ) : error ? (
            <span className="flex items-start gap-1.5 text-red-600"><AlertCircle className="mt-px size-3.5 shrink-0" />{error}</span>
          ) : dirty ? (
            <span className="text-amber-600">Unsaved changes</span>
          ) : showSaved ? (
            <span className="flex items-center gap-1.5 text-teal-600"><CheckCircle2 className="size-3.5" />All changes saved</span>
          ) : (
            <span className="text-gray-400">No changes</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onDiscard && (
          <Button variant="outline" onClick={onDiscard} disabled={!dirty || saving}>
            {discardLabel}
          </Button>
        )}
        <Button
          onClick={onSave}
          disabled={!dirty || saving || saveDisabled}
          className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {saving ? 'Saving...' : label}
        </Button>
      </div>
    </div>
  );
}
