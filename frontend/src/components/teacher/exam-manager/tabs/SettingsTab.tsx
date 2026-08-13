import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Clock, GraduationCap, Loader2, Shield, Shuffle } from 'lucide-react';

import { teacherExamSettingsService } from '../../../../services/teacher-exam-settings.service';
import {
  defaultTeacherExamSettings,
  type TeacherExamSettingsPayload,
} from '../../../../types/examSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Switch } from '../../../ui/switch';
import { SectionSaveBar } from '../SectionSaveBar';
import type { ResultStrategy } from '../../../../types/teacher-results';
import type { ResultVisibility } from '../../../../types/teacher-exam';

interface SettingsTabProps {
  examId: string | null;
  resultVisibility: ResultVisibility;
  onResultVisibilityChange: (resultVisibility: ResultVisibility) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const gradingMethods: { value: ResultStrategy; label: string}[] = [
  { value: 'highest', label: 'Highest'},
  { value: 'last_attempt', label: 'Last Attempt'},
  { value: 'average', label: 'Average'},
];

const isResultStrategy = (value: string): value is ResultStrategy =>
  gradingMethods.some((method) => method.value === value);

const visibilityOptions: { value: ResultVisibility; label: string}[] = [
  { value: 'hidden', label: 'Hidden'},
  { value: 'score-only', label: 'Score Only'},
  { value: 'full', label: 'Full Results'},
];

const isResultVisibility = (value: string): value is ResultVisibility =>
  visibilityOptions.some((option) => option.value === value);

const snapshotOf = (settings: TeacherExamSettingsPayload, resultVisibility: ResultVisibility) =>
  JSON.stringify({ settings, resultVisibility });

/** Returns a message when the payload is not safe to send, otherwise null. */
const validateSettings = (settings: TeacherExamSettingsPayload): string | null => {
  if (!Number.isInteger(settings.grace_period) || settings.grace_period < 0) {
    return 'Grace period must be a non-negative integer.';
  }
  if (
    settings.anti_cheat_enabled
    && (!Number.isInteger(settings.violation_limit) || settings.violation_limit < 1 || settings.violation_limit > 100)
  ) {
    return 'Maximum Violations must be a whole number from 1 to 100 when anti-cheat is enabled.';
  }
  return null;
};

export function SettingsTab({ examId, resultVisibility, onResultVisibilityChange, onDirtyChange }: SettingsTabProps) {
  const [settings, setSettings] = useState<TeacherExamSettingsPayload>(defaultTeacherExamSettings);
  const [draftResultVisibility, setDraftResultVisibility] = useState<ResultVisibility>(resultVisibility);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** Serialized state as last persisted; null until the first load completes. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const persistedExamId = examId && !examId.startsWith('new-') ? Number(examId) : null;
  const currentExamId = useRef<number | null>(persistedExamId);
  currentExamId.current = persistedExamId;

  useEffect(() => {
    setDraftResultVisibility(resultVisibility);
  }, [resultVisibility]);

  useEffect(() => {
    let active = true;
    if (!persistedExamId) {
      setBaseline(null);
      setSettings(defaultTeacherExamSettings);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setBaseline(null);

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await teacherExamSettingsService.get(persistedExamId);
        if (!active) return;
        const mapped: TeacherExamSettingsPayload = {
          shuffle_question: data.shuffle_question,
          shuffle_answer_options: data.shuffle_answer_options,
          sequential_navigation: data.sequential_navigation,
          auto_submit_on_expire: data.auto_submit_on_expire,
          grace_period: data.grace_period,
          anti_cheat_enabled: data.anti_cheat_enabled ?? false,
          violation_limit: data.violation_limit ?? 5,
          auto_grade: data.auto_grade,
          result_strategy: data.result_strategy,
        };
        setBaseline(snapshotOf(mapped, resultVisibility));
        setSettings(mapped);
        setSavedAt(null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load exam settings.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [persistedExamId]);

  const dirty = useMemo(
    () => baseline !== null && snapshotOf(settings, draftResultVisibility) !== baseline,
    [baseline, settings, draftResultVisibility],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const validationError = useMemo(() => validateSettings(settings), [settings]);

  const setBoolean = (field: keyof TeacherExamSettingsPayload, value: boolean) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const setNonNegativeNumber = (field: keyof TeacherExamSettingsPayload, rawValue: string) => {
    const value = Number(rawValue);
    setSettings((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  };

  const updateViolationLimit = (rawValue: string) => {
    const value = Number(rawValue);
    const violation_limit = rawValue.trim() === '' || !Number.isFinite(value) ? Number.NaN : value;
    setSettings((current) => ({ ...current, violation_limit }));
  };

  const saveSettings = async () => {
    if (!persistedExamId) {
      setError('Create the exam before saving settings.');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const targetExamId = persistedExamId;
      setSaving(true);
      setError(null);
      const saved = await teacherExamSettingsService.update(targetExamId, settings);
      if (currentExamId.current !== targetExamId) return;
      if (draftResultVisibility !== resultVisibility) {
        await onResultVisibilityChange(draftResultVisibility);
        if (currentExamId.current !== targetExamId) return;
      }
      const persisted: TeacherExamSettingsPayload = {
        shuffle_question: saved.shuffle_question,
        shuffle_answer_options: saved.shuffle_answer_options,
        sequential_navigation: saved.sequential_navigation,
        auto_submit_on_expire: saved.auto_submit_on_expire,
        grace_period: saved.grace_period,
        anti_cheat_enabled: saved.anti_cheat_enabled,
        violation_limit: saved.violation_limit,
        auto_grade: saved.auto_grade,
        result_strategy: saved.result_strategy,
      };
      setBaseline(snapshotOf(persisted, draftResultVisibility));
      setSettings(persisted);
      setSavedAt(Date.now());
    } catch (saveError) {
      // Dirty state is intentionally left untouched so the teacher can retry.
      const message = saveError instanceof Error ? saveError.message : 'Unable to save exam settings.';
      if (currentExamId.current === persistedExamId) setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!persistedExamId) {
    return <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Create the exam before configuring settings.</div>;
  }
  if (loading) {
    return <div className="flex h-48 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" /> Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader>
          <CardTitle>Result Visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={draftResultVisibility}
            onValueChange={(value) => {
              if (isResultVisibility(value)) {
                setDraftResultVisibility(value);
              }
            }}
          >
            <SelectTrigger id="result-visibility" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {visibilityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="font-medium">{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shuffle className="size-5 text-teal-600" /> Randomization</CardTitle>
          <CardDescription>Randomize question and answer order for each student.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><Label htmlFor="shuffle-question">Shuffle Questions</Label><Switch id="shuffle-question" checked={settings.shuffle_question} onCheckedChange={(value) => setBoolean('shuffle_question', value)} /></div>
          <div className="flex items-center justify-between"><Label htmlFor="shuffle-options">Shuffle Answer Options</Label><Switch id="shuffle-options" checked={settings.shuffle_answer_options} onCheckedChange={(value) => setBoolean('shuffle_answer_options', value)} /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader>
          <CardTitle>Question Navigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sequential-navigation">Require Sequential Completion</Label>
            <Switch
              id="sequential-navigation"
              checked={settings.sequential_navigation}
              onCheckedChange={(value) => setBoolean('sequential_navigation', value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-5 text-teal-600" /> Time Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><Label htmlFor="auto-submit">Auto-submit on Time Expiry</Label><Switch id="auto-submit" checked={settings.auto_submit_on_expire} onCheckedChange={(value) => setBoolean('auto_submit_on_expire', value)} /></div>
          <div className="space-y-2"><Label htmlFor="grace-period">Grace Period (minutes)</Label><Input id="grace-period" type="number" min="0" step="1" value={settings.grace_period} onChange={(event) => setNonNegativeNumber('grace_period', event.target.value)} className="max-w-xs" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 border-l-4 border-l-red-500 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="size-5 text-red-600" /> Anti-Cheating Measures</CardTitle>
          <CardDescription>Set one shared limit for every recorded anti-cheat violation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between"><Label htmlFor="anti-cheat">Enable Anti-Cheat</Label><Switch id="anti-cheat" checked={settings.anti_cheat_enabled} onCheckedChange={(value) => setBoolean('anti_cheat_enabled', value)} /></div>
          {settings.anti_cheat_enabled && (
            <div className="space-y-4 border-t border-gray-200 pt-4">
              <div className="space-y-2">
                <Label htmlFor="violation-limit">Maximum Violations</Label>
                <Input
                  id="violation-limit"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={Number.isFinite(settings.violation_limit) ? settings.violation_limit : ''}
                  onChange={(event) => updateViolationLimit(event.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-500">All recorded anti-cheat violations count toward this shared limit.</p>
              </div>
            </div>
          )}
          <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            <p>Anti-cheat requires camera, microphone, and fullscreen before an attempt starts.</p>
            <p>Reaching the limit automatically ends the current attempt with a score of 0.</p>
            <p>Other attempts remain available when the exam still has attempts left.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-teal-600" /> Grading Settings</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between"><Label htmlFor="auto-grade">Auto-grade MCQ</Label><Switch id="auto-grade" checked={settings.auto_grade} onCheckedChange={(value) => setBoolean('auto_grade', value)} /></div>
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <div>
              <Label htmlFor="grading-method" className="flex items-center gap-2"><GraduationCap className="size-4 text-teal-600" /> Grading Method</Label>
            </div>
            <Select
              value={settings.result_strategy}
              onValueChange={(value) => {
                if (isResultStrategy(value)) {
                  setSettings((current) => ({ ...current, result_strategy: value }));
                }
              }}
            >
              <SelectTrigger id="grading-method" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {gradingMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <span className="font-medium">{method.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <SectionSaveBar
        label="Save Settings"
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error ?? validationError}
        saveDisabled={validationError !== null}
        onSave={() => void saveSettings()}
      />
    </div>
  );
}
