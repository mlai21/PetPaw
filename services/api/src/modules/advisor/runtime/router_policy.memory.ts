import type {
  RollingStats,
  RouterDecision,
  RouterDecisionInput,
  RouterPolicy,
} from './router_policy.types';

type SignalRecord = {
  timestampMs: number;
  toolResult?: 'success' | 'fail' | 'empty';
  verifyOutcome?: 'pass' | 'fail';
};

type Options = {
  enabled: boolean;
  mode: 'rolling_stats_only' | 'with_policy_table';
  windowMs?: number;
};

const POLICY_VERSION_MEMORY = 'memory-rolling-v1';

export function createMemoryRouterPolicy(options: Options): RouterPolicy {
  const windowMs = options.windowMs ?? 300000;
  let records: SignalRecord[] = [];

  function prune(now: number): void {
    const cutoff = now - windowMs;
    if (records.length === 0 || records[0].timestampMs >= cutoff) return;
    records = records.filter((r) => r.timestampMs >= cutoff);
  }

  function computeStats(): RollingStats {
    prune(Date.now());
    const stats: RollingStats = {
      toolFailureCount: 0,
      toolTotalCount: 0,
      verifyFailCount: 0,
      verifyTotalCount: 0,
    };
    for (const r of records) {
      if (r.toolResult) {
        stats.toolTotalCount += 1;
        if (r.toolResult === 'fail') stats.toolFailureCount += 1;
      }
      if (r.verifyOutcome) {
        stats.verifyTotalCount += 1;
        if (r.verifyOutcome === 'fail') stats.verifyFailCount += 1;
      }
    }
    return stats;
  }

  function decideDPolicy<T>(input: RouterDecisionInput<T>): T | null {
    if (input.decisionPoint === 'setSearchTimeout') {
      if (input.signal.recentToolFailureRate > 0.5) {
        // 高失败率 -> 缩短超时为默认的一半（不低于 3000ms）
        const defaultValue = input.defaults.value as unknown as number;
        const next = Math.max(3000, Math.floor(defaultValue / 2));
        return next as unknown as T;
      }
    }
    if (input.decisionPoint === 'setMaxTurns') {
      if (input.signal.recentVerifyFailRate > 0.4) {
        const defaultValue = input.defaults.value as unknown as number;
        return (defaultValue + 1) as unknown as T;
      }
    }
    if (input.decisionPoint === 'routeIntent') {
      if (input.signal.keywordCategory === 'explicit_search') {
        return true as unknown as T;
      }
    }
    return null;
  }

  return {
    decide<T>(input: RouterDecisionInput<T>): RouterDecision<T> {
      if (input.humanOverride) {
        return {
          source: 'human_override',
          value: input.humanOverride.value,
          reason: input.humanOverride.reason,
        };
      }
      if (options.enabled) {
        const dValue = decideDPolicy(input);
        if (dValue !== null) {
          return { source: 'd_policy', value: dValue, policyVersion: POLICY_VERSION_MEMORY };
        }
      }
      return { source: 'default', value: input.defaults.value };
    },
    recordSignal(event) {
      const now = Date.now();
      prune(now);
      records.push({ timestampMs: now, ...event });
    },
    getStats() {
      return computeStats();
    },
  };
}
