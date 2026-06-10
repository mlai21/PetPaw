import { ceilTo, percentile } from './_stats';

export type V4Sample = {
  keywordCategory: string | null;
  toolDurationMs: number;
};

export type V4Policy = {
  scope: 'setSearchTimeout';
  conditions: { keyword_category: string };
  actions: { timeout_ms: number };
};

const MIN_SAMPLES_PER_GROUP = 10;
const FLOOR_MS = 5000;
const ROUND_STEP_MS = 1000;

export function learnV4SearchTimeout(samples: V4Sample[]): V4Policy[] {
  const byCategory = new Map<string, number[]>();
  for (const s of samples) {
    if (!s.keywordCategory) continue;
    const list = byCategory.get(s.keywordCategory) ?? [];
    list.push(s.toolDurationMs);
    byCategory.set(s.keywordCategory, list);
  }

  const policies: V4Policy[] = [];
  for (const [category, durations] of byCategory.entries()) {
    if (durations.length < MIN_SAMPLES_PER_GROUP) continue;
    const p95 = percentile(durations, 0.95);
    const timeout = ceilTo(Math.max(FLOOR_MS, p95 * 1.5), ROUND_STEP_MS);
    policies.push({
      scope: 'setSearchTimeout',
      conditions: { keyword_category: category },
      actions: { timeout_ms: timeout },
    });
  }
  return policies;
}
