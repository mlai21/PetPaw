import {
  createMemoryRouterPolicy,
} from '../../../src/modules/advisor/runtime/router_policy.memory';

describe('Memory RouterPolicy (E.1) - three-tier degradation chain', () => {
  const baseInput = {
    decisionPoint: 'setSearchTimeout' as const,
    signal: {
      messageLengthBucket: 'short' as const,
      keywordCategory: null,
      recentToolFailureRate: 0,
      recentVerifyFailRate: 0,
    },
    defaults: { value: 12000 },
  };

  it('returns default when D disabled and no human override', () => {
    const policy = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });
    const result = policy.decide(baseInput);
    expect(result.source).toBe('default');
    expect(result.value).toBe(12000);
  });

  it('returns human override even when D enabled', () => {
    const policy = createMemoryRouterPolicy({ enabled: true, mode: 'rolling_stats_only' });
    const result = policy.decide({
      ...baseInput,
      humanOverride: { value: 5000, reason: 'env_set' },
    });
    expect(result.source).toBe('human_override');
    expect(result.value).toBe(5000);
  });

  it('returns rolling-stats decision when D enabled and signal triggers', () => {
    const policy = createMemoryRouterPolicy({ enabled: true, mode: 'rolling_stats_only' });
    // 模拟"近期失败率高"
    for (let i = 0; i < 10; i++) {
      policy.recordSignal({ toolResult: 'fail' });
    }
    const result = policy.decide({
      ...baseInput,
      signal: { ...baseInput.signal, recentToolFailureRate: 0.7 },
    });
    expect(result.source).toBe('d_policy');
    // 高失败率 -> 缩短超时
    expect(result.value).toBeLessThan(12000);
  });

  it('rolling stats window evicts old entries', async () => {
    const policy = createMemoryRouterPolicy({
      enabled: true,
      mode: 'rolling_stats_only',
      windowMs: 50,
    });
    policy.recordSignal({ toolResult: 'fail' });
    const initial = policy.getStats();
    expect(initial.toolFailureCount).toBe(1);
    await new Promise((r) => setTimeout(r, 80));
    const evicted = policy.getStats();
    expect(evicted.toolFailureCount).toBe(0);
  });
});
