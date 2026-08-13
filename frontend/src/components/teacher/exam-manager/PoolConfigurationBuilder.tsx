import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Shuffle, Users } from 'lucide-react';

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

/** Pool configuration the teacher has composed but not yet persisted. */
export interface PoolDraft {
  fixed_randomization: boolean;
  rules: PoolRulePayload[];
}

interface PoolConfigurationBuilderProps {
  examId: number;
  subjectId: string;
  initialConfig: PoolConfig | null;
  /** Draft held by the host so reopening the modal keeps unsaved edits. */
  draft: PoolDraft | null;
  onDraftChange: (draft: PoolDraft | null) => void;
  /** Closes the modal. Persisting happens from the Questions section save bar. */
  onDone: () => void;
}

type RuleCounts = Record<string, number>;
type RuleMaxScores = Record<string, number>;

const difficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const ruleKey = (row: Pick<PoolAvailabilityRow, 'chapter_id' | 'lo_id' | 'difficulty'>) =>
  `${row.chapter_id}:${row.lo_id ?? 'all'}:${row.difficulty}`;

const difficultyStyle: Record<QuestionDifficulty, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

/** Order-independent serialization so drafts can be compared with the saved config. */
export const serializePoolDraft = (draft: PoolDraft) => JSON.stringify({
  fixed_randomization: draft.fixed_randomization,
  rules: [...draft.rules]
    .map((rule) => ({ ...rule, key: ruleKey(rule) }))
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({ key, ...rule }) => { void key; return rule; }),
});

export const poolConfigAsDraft = (config: PoolConfig | null): PoolDraft => ({
  fixed_randomization: config?.fixed_randomization ?? false,
  rules: (config?.rules ?? []).map((rule) => ({
    chapter_id: rule.chapter_id,
    lo_id: rule.lo_id,
    difficulty: rule.difficulty,
    draw_count: rule.draw_count,
    max_score_per_question: rule.max_score_per_question,
  })),
});

export function PoolConfigurationBuilder({
  examId,
  subjectId,
  initialConfig,
  draft,
  onDraftChange,
  onDone,
}: PoolConfigurationBuilderProps) {
  const [availability, setAvailability] = useState<PoolAvailabilityRow[]>([]);
  const [counts, setCounts] = useState<RuleCounts>({});
  const [maxScores, setMaxScores] = useState<RuleMaxScores>({});
  const [fixedRandomization, setFixedRandomization] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Seed once: an in-progress draft wins over whatever is currently persisted.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const source = draft ?? poolConfigAsDraft(initialConfig);
    setFixedRandomization(source.fixed_randomization);
    setCounts(Object.fromEntries(source.rules.map((rule) => [ruleKey(rule), rule.draw_count])));
    setMaxScores(Object.fromEntries(source.rules.map((rule) => [ruleKey(rule), rule.max_score_per_question])));
  }, [draft, initialConfig]);

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

  // Only the buckets the teacher actually drew from need a points value, so the
  // points inputs live in their own section instead of being crammed into each cell.
  const activeRows = useMemo(
    () => availability.filter((row) => (counts[ruleKey(row)] ?? 0) > 0),
    [availability, counts],
  );

  const totalQuestions = rules.reduce((sum, rule) => sum + rule.draw_count, 0);
  const totalPoints = rules.reduce(
    (sum, rule) => sum + rule.draw_count * (Number.isFinite(rule.max_score_per_question) ? rule.max_score_per_question : 0),
    0,
  );
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

  const persistedSnapshot = useMemo(
    () => serializePoolDraft(poolConfigAsDraft(initialConfig)),
    [initialConfig],
  );

  // Nothing is sent from here: the composed draft is handed to the Questions
  // section, which owns the single "Save Question Pool" action.
  useEffect(() => {
    if (loading) return;
    const current: PoolDraft = { fixed_randomization: fixedRandomization, rules };
    onDraftChange(serializePoolDraft(current) === persistedSnapshot ? null : current);
  }, [rules, fixedRandomization, persistedSnapshot, loading, onDraftChange]);

  const draftError = rules.length === 0
    ? 'Enter how many questions to draw from at least one topic.'
    : invalidRows.length > 0
      ? 'Some topics ask for more questions than the question bank has available.'
      : invalidMaxScore
        ? 'Every topic you draw from needs points per question greater than 0.'
        : null;

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-gray-600"><Loader2 className="size-5 animate-spin" /> Checking how many questions are available...</div>;
  }

  const describeRow = (row: PoolAvailabilityRow) => ({
    chapter: row.chapter_name,
    scope: row.lo_name ?? 'Whole chapter',
  });

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Plain-language explanation of what this screen does. */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="size-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          Instead of picking questions one by one, you describe the exam you want — for example
          "3 easy questions from Chapter 1". The system then draws matching questions from the
          question bank automatically.
        </AlertDescription>
      </Alert>

      {taxonomyRows.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-gray-500">This subject has no chapters with questions you can use yet. Add questions to the question bank first.</CardContent></Card>
      ) : (
        <>
          {/* Step 1 - how many questions from where */}
          <Card>
            <CardHeader className="border-b bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Step 1 — Choose how many questions to draw</h3>
              <p className="text-xs text-gray-500">
                Type a number for each topic and difficulty you want to include. Leave a box empty to skip it.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-medium text-gray-600">
                    <th className="p-3 text-left">Chapter</th>
                    <th className="p-3 text-left">Covers</th>
                    {difficulties.map((difficulty) => (
                      <th key={difficulty} className="p-3 text-center capitalize">{difficulty}</th>
                    ))}
                    <th className="p-3 text-center">Row total</th>
                  </tr>
                </thead>
                <tbody>
                  {taxonomyRows.map((taxonomy) => {
                    const rowValues = difficulties
                      .map((difficulty) => availability.find((row) =>
                        row.chapter_id === taxonomy.chapter_id
                        && row.lo_id === taxonomy.lo_id
                        && row.difficulty === difficulty))
                      .filter((row): row is PoolAvailabilityRow => Boolean(row));
                    const subtotal = rowValues.reduce((sum, row) => sum + (counts[ruleKey(row)] ?? 0), 0);
                    return (
                      <tr key={`${taxonomy.chapter_id}:${taxonomy.lo_id ?? 'all'}`} className="border-b last:border-0">
                        <td className="p-3 text-sm text-gray-800">{taxonomy.chapter_name}</td>
                        <td className="p-3 text-sm text-gray-600">{taxonomy.lo_name ?? 'Whole chapter'}</td>
                        {rowValues.map((row) => {
                          const count = counts[ruleKey(row)] ?? 0;
                          const invalid = count > row.available_count;
                          const noneAvailable = row.available_count === 0;
                          return (
                            <td key={row.difficulty} className="p-3 align-top">
                              <div className="mx-auto w-24 space-y-1">
                                <Input
                                  aria-label={`Questions to draw from ${taxonomy.chapter_name}, ${taxonomy.lo_name ?? 'whole chapter'}, ${row.difficulty}`}
                                  type="number"
                                  min={0}
                                  max={row.available_count}
                                  value={count || ''}
                                  placeholder="0"
                                  disabled={noneAvailable}
                                  onChange={(event) => updateCount(row, event.target.value)}
                                  className={`text-center ${invalid ? 'border-red-500' : ''} ${noneAvailable ? 'bg-gray-50' : ''}`}
                                />
                                <p className={`text-center text-xs ${invalid ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                                  {noneAvailable ? 'none available' : `of ${row.available_count} available`}
                                </p>
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3 text-center">
                          <Badge variant="outline">{subtotal}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Step 2 - points, only for the buckets actually used */}
          <Card>
            <CardHeader className="border-b bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Step 2 — Set points per question</h3>
              <p className="text-xs text-gray-500">
                Only the topics you drew from appear here. Final scores are normalized to 100, so these
                are relative weights.
              </p>
            </CardHeader>
            <CardContent className="p-4">
              {activeRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Enter some question counts in Step 1 first.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeRows.map((row) => {
                    const { chapter, scope } = describeRow(row);
                    const count = counts[ruleKey(row)] ?? 0;
                    const maxScore = maxScores[ruleKey(row)] ?? 1;
                    const invalid = !Number.isFinite(maxScore) || maxScore <= 0;
                    return (
                      <div key={ruleKey(row)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{chapter}</span>
                            <Badge className={`${difficultyStyle[row.difficulty]} capitalize`}>{row.difficulty}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{scope} · {count} question{count === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            aria-label={`Points per question for ${chapter}, ${scope}, ${row.difficulty}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={maxScore}
                            onChange={(event) => updateMaxScore(row, event.target.value)}
                            className={`w-24 text-center ${invalid ? 'border-red-500' : ''}`}
                          />
                          <span className="whitespace-nowrap text-xs text-gray-500">points each</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3 - who gets which questions, both options visible at once */}
          <Card>
            <CardHeader className="border-b bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Step 3 — Who gets which questions?</h3>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <button
                type="button"
                role="radio"
                aria-checked={!fixedRandomization}
                onClick={() => setFixedRandomization(false)}
                className={`rounded-xl border-2 p-4 text-left transition ${!fixedRandomization ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Shuffle className={`size-4 ${!fixedRandomization ? 'text-teal-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-800">Different set per student</span>
                  {!fixedRandomization && <CheckCircle2 className="ml-auto size-4 text-teal-600" />}
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Each student gets their own draw when they start. Best for reducing copying.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={fixedRandomization}
                onClick={() => setFixedRandomization(true)}
                className={`rounded-xl border-2 p-4 text-left transition ${fixedRandomization ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Users className={`size-4 ${fixedRandomization ? 'text-teal-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-800">Same set for everyone</span>
                  {fixedRandomization && <CheckCircle2 className="ml-auto size-4 text-teal-600" />}
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Draw once now, then review and edit the questions like a normal exam.
                </p>
              </button>
            </CardContent>
          </Card>
        </>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-white py-3">
        <div className="min-w-0 text-sm text-gray-600">
          <div>
            <span className="font-medium text-gray-800">{totalQuestions} question{totalQuestions === 1 ? '' : 's'}</span> per attempt
            {totalQuestions > 0 && <span className="text-gray-500"> · {Number(totalPoints.toFixed(2))} raw points total</span>}
          </div>
          <p className="text-xs text-gray-500">
            {draftError ?? 'Nothing is saved yet — use "Save Question Pool" in the Questions tab to apply this.'}
          </p>
        </div>
        <Button onClick={onDone} disabled={draftError !== null}>
          <CheckCircle2 className="mr-2 size-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
