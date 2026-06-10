import { runDLearnerOnce } from '../../../src/modules/advisor/learner/d_learner.entry';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('runDLearnerOnce orchestration', () => {
  it('publishes policies derived from recent trace (V3/V4/V8)', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    const now = Date.now();

    // 写入 12 个 runtime + 各一个需搜索任务（weather/tavily 成功），轮次=3
    for (let i = 0; i < 12; i++) {
      await store.upsertSession({ sessionId: `s${i}`, userId: 'u' });
      await store.writeRuntime({
        runId: `r${i}`,
        sessionId: `s${i}`,
        startedAtMs: now - 1000,
        endedAtMs: now,
        terminalState: 'R_COMPLETED',
        totalTurns: 3,
        totalTasks: 1,
        messageLengthBucket: 'short',
        policyVersion: 'none',
      });
      await store.writeTask({
        taskId: `t${i}`,
        runId: `r${i}`,
        taskIndex: 0,
        terminalState: 'T_DONE',
        needSearch: true,
        toolUsed: 'tavily-search',
        toolResult: i < 10 ? 'success' : 'fail',
        durationMs: 2000,
        retryCount: 0,
        keywordCategory: 'weather',
      });
    }

    const result = await runDLearnerOnce(store, { lookbackDays: 7, now });
    expect(result.publishedVersions.length).toBeGreaterThan(0);

    const timeoutPolicies = await store.activePolicies('setSearchTimeout');
    expect(timeoutPolicies.length).toBeGreaterThan(0);
    const maxTurnPolicies = await store.activePolicies('setMaxTurns');
    expect(maxTurnPolicies.length).toBe(1);
    expect(JSON.parse(maxTurnPolicies[0].actionsJson).max_turns).toBe(3);

    store.close();
  });

  it('publishes nothing when there is no recent trace', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    const result = await runDLearnerOnce(store, { now: Date.now() });
    expect(result.publishedVersions).toEqual([]);
    store.close();
  });
});
