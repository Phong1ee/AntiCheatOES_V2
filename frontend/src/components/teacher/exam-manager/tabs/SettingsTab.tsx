import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, Loader2, Save, Shield, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

import { teacherExamSettingsService } from '../../../../services/teacher-exam-settings.service';
import {
  defaultTeacherExamSettings,
  type TeacherExamSettingsPayload,
} from '../../../../types/examSettings';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Switch } from '../../../ui/switch';

interface SettingsTabProps {
  examId: string | null;
}

type ThresholdField = 'force_fullscreen_thresh' | 'tab_switch_thresh' | 'copy_paste_thresh';

export function SettingsTab({ examId }: SettingsTabProps) {
  const [settings, setSettings] = useState<TeacherExamSettingsPayload>(defaultTeacherExamSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPositive = useRef<Record<ThresholdField, number>>({
    force_fullscreen_thresh: 1,
    tab_switch_thresh: 1,
    copy_paste_thresh: 1,
  });

  const persistedExamId = examId && !examId.startsWith('new-') ? Number(examId) : null;
  const currentExamId = useRef<number | null>(persistedExamId);
  currentExamId.current = persistedExamId;

  useEffect(() => {
    let active = true;
    if (!persistedExamId) {
      setSettings(defaultTeacherExamSettings);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await teacherExamSettingsService.get(persistedExamId);
        if (!active) return;
        const mapped: TeacherExamSettingsPayload = {
          shuffle_question: data.shuffle_question,
          shuffle_answer_options: data.shuffle_answer_options,
          auto_submit_on_expire: data.auto_submit_on_expire,
          grace_period: data.grace_period,
          force_fullscreen_thresh: data.force_fullscreen_thresh,
          tab_switch_thresh: data.tab_switch_thresh,
          copy_paste_thresh: data.copy_paste_thresh,
          auto_grade: data.auto_grade,
        };
        (['force_fullscreen_thresh', 'tab_switch_thresh', 'copy_paste_thresh'] as ThresholdField[])
          .forEach((field) => {
            if (mapped[field] > 0) lastPositive.current[field] = mapped[field];
          });
        setSettings(mapped);
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

  const antiCheatEnabled = settings.force_fullscreen_thresh > 0
    || settings.tab_switch_thresh > 0
    || settings.copy_paste_thresh > 0;

  const setBoolean = (field: keyof TeacherExamSettingsPayload, value: boolean) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const setNonNegativeNumber = (field: keyof TeacherExamSettingsPayload, rawValue: string) => {
    const value = Number(rawValue);
    setSettings((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  };

  const toggleAntiCheat = (enabled: boolean) => {
    setSettings((current) => {
      const fields: ThresholdField[] = ['force_fullscreen_thresh', 'tab_switch_thresh', 'copy_paste_thresh'];
      if (!enabled) {
        fields.forEach((field) => {
          if (current[field] > 0) lastPositive.current[field] = current[field];
        });
        return {
          ...current,
          force_fullscreen_thresh: 0,
          tab_switch_thresh: 0,
          copy_paste_thresh: 0,
        };
      }
      return {
        ...current,
        force_fullscreen_thresh: current.force_fullscreen_thresh > 0
          ? current.force_fullscreen_thresh
          : lastPositive.current.force_fullscreen_thresh,
        tab_switch_thresh: current.tab_switch_thresh > 0
          ? current.tab_switch_thresh
          : lastPositive.current.tab_switch_thresh,
        copy_paste_thresh: current.copy_paste_thresh > 0
          ? current.copy_paste_thresh
          : lastPositive.current.copy_paste_thresh,
      };
    });
  };

  const updateThreshold = (field: ThresholdField, rawValue: string) => {
    const value = Number(rawValue);
    const nextValue = rawValue.trim() === '' || !Number.isFinite(value) ? Number.NaN : value;
    if (nextValue > 0) lastPositive.current[field] = nextValue;
    setSettings((current) => ({ ...current, [field]: nextValue }));
  };

  const saveSettings = async () => {
    if (!persistedExamId) {
      setError('Create the exam before saving settings.');
      return;
    }
    const numericValues = [
      settings.grace_period,
      settings.force_fullscreen_thresh,
      settings.tab_switch_thresh,
      settings.copy_paste_thresh,
    ];
    if (numericValues.some((value) => !Number.isInteger(value) || value < 0)) {
      setError('Grace period and thresholds must be non-negative integers.');
      return;
    }
    const payload: TeacherExamSettingsPayload = antiCheatEnabled
      ? settings
      : {
          ...settings,
          force_fullscreen_thresh: 0,
          tab_switch_thresh: 0,
          copy_paste_thresh: 0,
        };
    try {
      const targetExamId = persistedExamId;
      setSaving(true);
      setError(null);
      const saved = await teacherExamSettingsService.update(targetExamId, payload);
      if (currentExamId.current !== targetExamId) return;
      setSettings({
        shuffle_question: saved.shuffle_question,
        shuffle_answer_options: saved.shuffle_answer_options,
        auto_submit_on_expire: saved.auto_submit_on_expire,
        grace_period: saved.grace_period,
        force_fullscreen_thresh: saved.force_fullscreen_thresh,
        tab_switch_thresh: saved.tab_switch_thresh,
        copy_paste_thresh: saved.copy_paste_thresh,
        auto_grade: saved.auto_grade,
      });
      toast.success('Exam settings saved.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save exam settings.';
      if (currentExamId.current === persistedExamId) {
        setError(message);
        toast.error(message);
      }
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

  const thresholdControl = (field: ThresholdField, label: string, help: string) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={field}>{label}</Label>
        <p className="text-xs text-gray-500">{help}</p>
      </div>
      <Input
        id={field}
        type="number"
        min="0"
        step="1"
        value={Number.isFinite(settings[field]) ? settings[field] : ''}
        onChange={(event) => updateThreshold(field, event.target.value)}
        className="w-24 text-center"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

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
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-5 text-teal-600" /> Time Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><Label htmlFor="auto-submit">Auto-submit on Time Expiry</Label><Switch id="auto-submit" checked={settings.auto_submit_on_expire} onCheckedChange={(value) => setBoolean('auto_submit_on_expire', value)} /></div>
          <div className="space-y-2"><Label htmlFor="grace-period">Grace Period (minutes)</Label><Input id="grace-period" type="number" min="0" step="1" value={settings.grace_period} onChange={(event) => setNonNegativeNumber('grace_period', event.target.value)} className="max-w-xs" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 border-l-4 border-l-red-500 shadow-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="size-5 text-red-600" /> Anti-Cheating Measures</CardTitle><CardDescription>A threshold of N allows N violations. Enforcement is not enabled yet.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between"><Label htmlFor="anti-cheat">Enable Anti-Cheat</Label><Switch id="anti-cheat" checked={antiCheatEnabled} onCheckedChange={toggleAntiCheat} /></div>
          {antiCheatEnabled && (
            <div className="space-y-4 border-t border-gray-200 pt-4">
              {thresholdControl('force_fullscreen_thresh', 'Force Fullscreen threshold', 'Allowed fullscreen exits before enforcement.')}
              {thresholdControl('tab_switch_thresh', 'Tab Switch threshold', 'Allowed tab switches before enforcement.')}
              {thresholdControl('copy_paste_thresh', 'Copy/Paste threshold', 'Allowed copy or paste events before enforcement.')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-teal-600" /> Grading Settings</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-between"><Label htmlFor="auto-grade">Auto-grade MCQ</Label><Switch id="auto-grade" checked={settings.auto_grade} onCheckedChange={(value) => setBoolean('auto_grade', value)} /></div></CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void saveSettings()} disabled={loading || saving} className="bg-gradient-to-r from-teal-500 to-blue-600">
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
