import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  questionService,
  type PoolAvailabilityRow,
  type PoolConfig,
  type PoolRulePayload,
} from '../../../services/question.service';
import type { QuestionDifficulty } from '../../../types/question-bank';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

interface PoolConfigurationBuilderProps {
  examId: number;
  subjectId: string;
  expectedVersion?: number;
  initialConfig: PoolConfig | null;
  onSaved: (config: PoolConfig) => Promise<void>;
}

type RuleCounts = Record<string, number>;
type RuleMaxScores = Record<string, number>;

const difficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const ruleKey = (row: Pick<PoolAvailabilityRow, 'chapter_id' | 'lo_id' | 'difficulty'>) =>
  `${row.chapter_id}:${row.lo_id ?? 'all'}:${row.difficulty}`;

export function PoolConfigurationBuilder({
  examId,
  subjectId,
  expectedVersion,
  initialConfig,
  onSaved,
}: PoolConfigurationBuilderProps) {
  const [availability, setAvailability] = useState<PoolAvailabilityRow[]>([]);
  const [counts, setCounts] = useState<RuleCounts>({});
  const [maxScores, setMaxScores] = useState<RuleMaxScores>({});
  const [fixedRandomization, setFixedRandomization] = useState(
    initialConfig?.fixed_randomization ?? false,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFixedRandomization(initialConfig?.fixed_randomization ?? false);
    setCounts(
      Object.fromEntries(
        (initialConfig?.rules ?? []).map((rule) => [
          `${rule.chapter_id}:${rule.lo_id ?? 'all'}:${rule.difficulty}`,
          rule.draw_count,
        ]),
      ),
    );
    setMaxScores(
      Object.fromEntries(
        (initialConfig?.rules ?? []).map((rule) => [
          `${rule.chapter_id}:${rule.lo_id ?? 'all'}:${rule.difficulty}`,
          rule.max_score_per_question,
        ]),
      ),
    );
  }, [initialConfig]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await questionService.getPoolAvailability(examId, subjectId);
        if (active) setAvailability(response.rows);
      } catch (loadError) {
        if (active) {
          setAvailability([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load pool availability.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [examId, subjectId]);

  const taxonomyRows = useMemo(() => {
    const unique = new Map<string, PoolAvailabilityRow>();
    availability.forEach((row) => {
      const key = `${row.chapter_id}:${row.lo_id ?? 'all'}`;
      if (!unique.has(key)) unique.set(key, row);
    });
    return [...unique.values()];
  }, [availability]);

  const rules = useMemo<PoolRulePayload[]>(
    () =>
      availability
        .map((row) => ({
          chapter_id: row.chapter_id,
          lo_id: row.lo_id,
          difficulty: row.difficulty,
          draw_count: counts[ruleKey(row)] ?? 0,
          max_score_per_question: maxScores[ruleKey(row)] ?? 1,
        }))
        .filter((rule) => rule.draw_count > 0),
    [availability, counts, maxScores],
  );
  const totalQuestions = rules.reduce((sum, rule) => sum + rule.draw_count, 0);
  const invalidRows = availability.filter(
    (row) => (counts[ruleKey(row)] ?? 0) > row.available_count,
  );
  const invalidMaxScore = rules.some(
    (rule) => !Number.isFinite(rule.max_score_per_question) || rule.max_score_per_question <= 0,
  );

  const updateCount = (row: PoolAvailabilityRow, rawValue: string) => {
    const value = Math.max(0, Number.parseInt(rawValue || '0', 10) || 0);
    setCounts((current) => ({ ...current, [ruleKey(row)]: value }));
  };

  const updateMaxScore = (row: PoolAvailabilityRow, rawValue: string) => {
    setMaxScores((current) => ({
      ...current,
      [ruleKey(row)]: Number(rawValue),
    }));
  };

  const save = async () => {
    if (rules.length === 0) {
      setError('Configure at least one question to draw.');
      return;
    }
    if (invalidRows.length > 0) {
      setError('One or more requested counts exceed server-reported availability.');
      return;
    }
    if (invalidMaxScore) {
      setError('Every active pool rule requires a positive Max Score.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const saved = await questionService.savePoolConfig(examId, {
        subject_id: subjectId,
        fixed_randomization: fixedRandomization,
        rules,
        expected_version: expectedVersion,
      });
      await onSaved(saved);
      toast.success(
        fixedRandomization
          ? 'Fixed randomized question set saved.'
          : 'Per-student pool configuration saved.',
      );
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save pool configuration.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" /> Loading real question availability...</div>;
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Available combinations</p><p className="text-2xl text-gray-800">{availability.filter((row) => row.available_count > 0).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Questions to draw</p><p className="text-2xl text-teal-700">{totalQuestions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Subject</p><p className="truncate text-lg text-gray-800">{subjectId}</p></CardContent></Card>
      </div>

      {taxonomyRows.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-gray-500">No chapters or eligible questions are available for this subject.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="border-b bg-gray-50 p-4">
            <h3 className="flex items-center gap-2 text-sm text-gray-800"><Settings2 className="size-4" /> Pool distribution matrix</h3>
            <p className="text-xs text-gray-500">Each row uses real Chapter and Learning Objective identifiers. “All LOs” is a chapter-wide rule.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-600"><th className="p-3 text-left">Chapter</th><th className="p-3 text-left">Learning Objective</th>{difficulties.map((difficulty) => <th key={difficulty} className="p-3 text-center capitalize">{difficulty}</th>)}<th className="p-3 text-center">Subtotal</th></tr></thead>
              <tbody>
                {taxonomyRows.map((taxonomy) => {
                  const rowValues = difficulties.map((difficulty) =>
                    availability.find((row) => row.chapter_id === taxonomy.chapter_id && row.lo_id === taxonomy.lo_id && row.difficulty === difficulty)!,
                  );
                  const subtotal = rowValues.reduce((sum, row) => sum + (counts[ruleKey(row)] ?? 0), 0);
                  return (
                    <tr key={`${taxonomy.chapter_id}:${taxonomy.lo_id ?? 'all'}`} className="border-b">
                      <td className="p-3 text-sm">{taxonomy.chapter_name}</td>
                      <td className="p-3 text-sm">{taxonomy.lo_name ?? 'All LOs in chapter'}</td>
                      {rowValues.map((row) => {
                        const count = counts[ruleKey(row)] ?? 0;
                        const invalid = count > row.available_count;
                        const maxScore = maxScores[ruleKey(row)] ?? 1;
                        return <td key={row.difficulty} className="p-3 text-center"><div className="mx-auto grid w-24 gap-1"><Input aria-label={`${taxonomy.chapter_name} ${taxonomy.lo_name ?? 'all learning objectives'} ${row.difficulty} draw count`} type="number" min={0} max={row.available_count} value={count || ''} onChange={(event) => updateCount(row, event.target.value)} className={`text-center ${invalid ? 'border-red-500' : ''}`} /><span className={`text-xs ${invalid ? 'text-red-600' : 'text-gray-500'}`}>Draw, of {row.available_count}</span>{count > 0 && <><Input aria-label={`${taxonomy.chapter_name} ${row.difficulty} max score per question`} type="number" min="0.01" step="0.01" value={maxScore} onChange={(event) => updateMaxScore(row, event.target.value)} className="text-center" /><span className="text-xs text-gray-500">Max each</span></>}</div></td>;
                      })}
                      <td className="p-3 text-center"><Badge variant="outline">{subtotal}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label htmlFor="fixed-randomization" className="text-sm font-medium">Fixed Randomization</Label>
            <p className="text-xs text-gray-500">{fixedRandomization ? 'Select once; every student receives the same editable fixed set.' : 'Draw a stable unique set when each student starts an attempt.'}</p>
          </div>
          <Switch id="fixed-randomization" aria-label="Use fixed randomization" checked={fixedRandomization} onCheckedChange={setFixedRandomization} disabled={saving} />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white py-3">
        <span className="text-sm text-gray-600">{totalQuestions} question{totalQuestions === 1 ? '' : 's'} per attempt</span>
        <Button onClick={() => void save()} disabled={saving || totalQuestions === 0 || invalidRows.length > 0 || invalidMaxScore}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
          {saving ? 'Saving...' : 'Save Pool Configuration'}
        </Button>
      </div>
    </div>
  );
}
