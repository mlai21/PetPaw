import { createPersistentRouterPolicy } from '../../../src/modules/advisor/runtime/router_policy';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('PersistentRouterPolicy with policy table + rollout', () => {
  it('falls back to default when no policy matches', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    const policy = createPersistentRouterPolicy({
      enabled: true,
      mode: 'with_policy_table',
      store,
      sessionId: 's1',
    });
    const result = await policy.decideAsync({
      decisionPoint: 'setSearchTimeout',
      signal: {
        messageLengthBucket: 'short',
        keywordCategory: 'weather',
        recentToolFailureRate: 0,
        recentVerifyFailRate: 0,
      },
      defaults: { value: 12000 },
    });
    expect(result.source).toBe('default');
    store.close();
  });

  it('applies policy when sessionId hash falls within rollout_pct', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await store.writePolicy({
      version: 'v-test',
      createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 100,
    });
    const policy = createPersistentRouterPolicy({
      enabled: true,
      mode: 'with_policy_table',
      store,
      sessionId: 's1',
    });
    const result = await policy.decideAsync({
      decisionPoint: 'setSearchTimeout',
      signal: {
        messageLengthBucket: 'short',
        keywordCategory: 'weather',
        recentToolFailureRate: 0,
        recentVerifyFailRate: 0,
      },
      defaults: { value: 12000 },
    });
    expect(result.source).toBe('d_policy');
    expect(result.value).toBe(6000);
    store.close();
  });

  it('does NOT apply policy when sessionId hash falls outside rollout_pct (sample at 5%)', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await store.writePolicy({
      version: 'v-test',
      createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 5,
    });
    let hitDPolicy = 0;
    let hitDefault = 0;
    for (let i = 0; i < 200; i++) {
      const policy = createPersistentRouterPolicy({
        enabled: true,
        mode: 'with_policy_table',
        store,
        sessionId: `s${i}`,
      });
      const result = await policy.decideAsync({
        decisionPoint: 'setSearchTimeout',
        signal: {
          messageLengthBucket: 'short',
          keywordCategory: 'weather',
          recentToolFailureRate: 0,
          recentVerifyFailRate: 0,
        },
        defaults: { value: 12000 },
      });
      if (result.source === 'd_policy') hitDPolicy++;
      else hitDefault++;
    }
    expect(hitDPolicy).toBeGreaterThan(2);
    expect(hitDPolicy).toBeLessThan(30);
    expect(hitDefault).toBeGreaterThan(170);
    store.close();
  });

  it('honors human override above policy table', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await store.writePolicy({
      version: 'v-test',
      createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 100,
    });
    const policy = createPersistentRouterPolicy({
      enabled: true,
      mode: 'with_policy_table',
      store,
      sessionId: 's1',
    });
    const result = await policy.decideAsync({
      decisionPoint: 'setSearchTimeout',
      signal: {
        messageLengthBucket: 'short',
        keywordCategory: 'weather',
        recentToolFailureRate: 0,
        recentVerifyFailRate: 0,
      },
      defaults: { value: 12000 },
      humanOverride: { value: 9000, reason: 'ops_pin' },
    });
    expect(result.source).toBe('human_override');
    expect(result.value).toBe(9000);
    store.close();
  });
});
