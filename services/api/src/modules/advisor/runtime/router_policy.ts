import { createHash } from 'node:crypto';
import { createMemoryRouterPolicy } from './router_policy.memory';
import type {
  DecisionPoint,
  RollingStats,
  RouterDecision,
  RouterDecisionInput,
  RouterPolicy,
  RuntimeSignal,
} from './router_policy.types';
import type { SessionStore } from '../persistence/session_store.types';

export { createMemoryRouterPolicy } from './router_policy.memory';

export type PersistentOptions = {
  enabled: boolean;
  mode: 'rolling_stats_only' | 'with_policy_table';
  store: SessionStore;
  sessionId: string;
  windowMs?: number;
};

export type PersistentRouterPolicy = RouterPolicy & {
  decideAsync<T>(input: RouterDecisionInput<T>): Promise<RouterDecision<T>>;
};

/**
 * 把 sessionId 稳定散列到 [0, 100)，用于灰度分流：当 hash < rollout_pct 时命中策略。
 */
function hashToPercent(seed: string): number {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 8);
  const n = parseInt(hex, 16);
  return n % 100;
}

function matchConditions(
  conditions: Record<string, unknown>,
  signal: RuntimeSignal,
): boolean {
  for (const [key, val] of Object.entries(conditions)) {
    if (key === 'keyword_category' && signal.keywordCategory !== val) return false;
    if (key === 'message_length_bucket' && signal.messageLengthBucket !== val) return false;
  }
  return true;
}

function extractValueByDecisionPoint(
  point: DecisionPoint,
  actions: Record<string, unknown>,
): unknown | null {
  switch (point) {
    case 'setSearchTimeout':
      return actions.timeout_ms ?? null;
    case 'routeIntent':
      return actions.force_plan ?? null;
    case 'setMaxTurns':
      return actions.max_turns ?? null;
    case 'selectToolOrder':
      return actions.tool_order ?? null;
    case 'shouldSkipVerify':
      return actions.skip_verify ?? null;
    case 'chooseTaskQuery':
      return actions.query_granularity ?? null;
    default:
      return null;
  }
}

export function createPersistentRouterPolicy(opts: PersistentOptions): PersistentRouterPolicy {
  // 复用内存版的滚动统计与同步 decide 逻辑
  const memory = createMemoryRouterPolicy({
    enabled: opts.enabled,
    mode: opts.mode,
    windowMs: opts.windowMs,
  });

  return {
    decide<T>(input: RouterDecisionInput<T>): RouterDecision<T> {
      return memory.decide(input);
    },
    async decideAsync<T>(input: RouterDecisionInput<T>): Promise<RouterDecision<T>> {
      // 三级降级链：human override > D policy（策略表/滚动统计） > default
      if (input.humanOverride) {
        return {
          source: 'human_override',
          value: input.humanOverride.value,
          reason: input.humanOverride.reason,
        };
      }
      if (!opts.enabled) {
        return { source: 'default', value: input.defaults.value };
      }

      if (opts.mode === 'with_policy_table') {
        const policies = await opts.store.activePolicies(input.decisionPoint);
        const userPct = hashToPercent(opts.sessionId);
        for (const p of policies) {
          if (userPct >= p.rolloutPct) continue;
          const conditions = JSON.parse(p.conditionsJson) as Record<string, unknown>;
          if (!matchConditions(conditions, input.signal)) continue;
          const actions = JSON.parse(p.actionsJson) as Record<string, unknown>;
          const value = extractValueByDecisionPoint(input.decisionPoint, actions);
          if (value !== null) {
            return { source: 'd_policy', value: value as T, policyVersion: p.version };
          }
        }
      }

      // 回退到内存滚动统计逻辑（可能再回退到 default）
      return memory.decide(input);
    },
    recordSignal(event) {
      memory.recordSignal(event);
    },
    getStats(): RollingStats {
      return memory.getStats();
    },
  };
}
