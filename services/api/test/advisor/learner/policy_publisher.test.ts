import { publishPolicy } from '../../../src/modules/advisor/learner/policy_publisher';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('publishPolicy', () => {
  it('writes new policy row with rolloutPct=10 by default', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await publishPolicy(store, {
      scope: 'routeIntent',
      conditions: { keyword_category: 'weather' },
      actions: { force_plan: true },
    });
    const policies = await store.activePolicies('routeIntent');
    expect(policies).toHaveLength(1);
    expect(policies[0].rolloutPct).toBe(10);
    store.close();
  });

  it('honors an explicit rolloutPct', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await publishPolicy(store, {
      scope: 'setMaxTurns',
      conditions: {},
      actions: { max_turns: 4 },
      rolloutPct: 50,
    });
    const policies = await store.activePolicies('setMaxTurns');
    expect(policies[0].rolloutPct).toBe(50);
    expect(JSON.parse(policies[0].actionsJson)).toEqual({ max_turns: 4 });
    store.close();
  });
});
