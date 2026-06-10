import { createHash } from 'node:crypto';

export type QueryGranularity = 'message_level' | 'task_level';

export type V5Sample = {
  keywordCategory: string | null;
  queryGranularity: QueryGranularity;
  taskOutcome: 'success' | 'fail';
};

export type V5Policy = {
  scope: 'chooseTaskQuery';
  conditions: { keyword_category: string };
  actions: { query_granularity: QueryGranularity };
};

const MIN_SAMPLES_PER_ARM = 10;
const SIGNIFICANT_LIFT = 0.1;
const EXPLORE_PCT = 5;

function successRate(samples: V5Sample[]): number {
  if (samples.length === 0) return 0;
  return samples.filter((s) => s.taskOutcome === 'success').length / samples.length;
}

export function learnV5QueryGranularity(samples: V5Sample[]): V5Policy[] {
  const byCategory = new Map<string, V5Sample[]>();
  for (const s of samples) {
    if (!s.keywordCategory) continue;
    const list = byCategory.get(s.keywordCategory) ?? [];
    list.push(s);
    byCategory.set(s.keywordCategory, list);
  }

  const policies: V5Policy[] = [];
  for (const [category, list] of byCategory.entries()) {
    const taskArm = list.filter((s) => s.queryGranularity === 'task_level');
    const messageArm = list.filter((s) => s.queryGranularity === 'message_level');
    if (taskArm.length < MIN_SAMPLES_PER_ARM || messageArm.length < MIN_SAMPLES_PER_ARM) continue;
    const lift = successRate(taskArm) - successRate(messageArm);
    if (lift > SIGNIFICANT_LIFT) {
      policies.push({
        scope: 'chooseTaskQuery',
        conditions: { keyword_category: category },
        actions: { query_granularity: 'task_level' },
      });
    }
  }
  return policies;
}

/**
 * 5% 探索：对约 5% 的会话强制采用 task_level，以持续收集对照样本。
 * 基于 sessionId 稳定散列，保证同一会话决策一致。
 */
export function shouldExploreTaskLevel(sessionId: string): boolean {
  const hex = createHash('sha256').update(`v5-explore:${sessionId}`).digest('hex').slice(0, 8);
  return parseInt(hex, 16) % 100 < EXPLORE_PCT;
}
