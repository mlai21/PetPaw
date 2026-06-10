import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('SqliteSessionStore', () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-ss-')), 'test.db');
  });

  it('upserts session, writes runtime + tasks + stage traces atomically', async () => {
    const store = createSqliteSessionStore({ dbPath });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    await store.writeRuntime({
      runId: 'r1',
      sessionId: 's1',
      startedAtMs: 1000,
      endedAtMs: 1500,
      terminalState: 'R_COMPLETED',
      totalTurns: 1,
      totalTasks: 2,
      messageLengthBucket: 'short',
      policyVersion: 'v1',
    });
    await store.writeTask({
      taskId: 't1',
      runId: 'r1',
      taskIndex: 0,
      terminalState: 'T_DONE',
      needSearch: true,
      toolUsed: 'tavily-search',
      toolResult: 'success',
      durationMs: 120,
      retryCount: 0,
      keywordCategory: 'weather',
    });
    await store.writeStageTrace({
      traceId: 'st1',
      runId: 'r1',
      stage: 'verify',
      durationMs: 50,
      outcome: 'pass',
    });
    const runs = await store.recentRuntimesBySession('s1', 5);
    expect(runs).toHaveLength(1);
    expect(runs[0].terminalState).toBe('R_COMPLETED');
    const tasks = await store.tasksByRun('r1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].keywordCategory).toBe('weather');
    const stages = await store.stageTracesByRun('r1');
    expect(stages.find((s) => s.stage === 'verify')?.outcome).toBe('pass');
    store.close();
  });

  it('prunes records older than retention days', async () => {
    const store = createSqliteSessionStore({ dbPath, retentionDays: 1 });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    const oldMs = Date.now() - 86400000 * 3; // 3 days ago
    await store.writeRuntime({
      runId: 'r-old',
      sessionId: 's1',
      startedAtMs: oldMs,
      endedAtMs: oldMs + 1000,
      terminalState: 'R_COMPLETED',
      totalTurns: 1,
      totalTasks: 1,
      messageLengthBucket: 'short',
      policyVersion: 'v1',
    });
    await store.writeRuntime({
      runId: 'r-new',
      sessionId: 's1',
      startedAtMs: Date.now(),
      endedAtMs: Date.now() + 1000,
      terminalState: 'R_COMPLETED',
      totalTurns: 1,
      totalTasks: 1,
      messageLengthBucket: 'short',
      policyVersion: 'v1',
    });
    await store.pruneOldRecords();
    const remaining = await store.recentRuntimesBySession('s1', 10);
    expect(remaining.map((r) => r.runId)).toEqual(['r-new']);
    store.close();
  });

  it('rejects writes containing PII-like fields (defense in depth)', async () => {
    const store = createSqliteSessionStore({ dbPath });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    await expect(
      store.writeRuntime({
        runId: 'r-bad',
        sessionId: 's1',
        startedAtMs: 1000,
        endedAtMs: 1500,
        terminalState: 'R_COMPLETED',
        totalTurns: 1,
        totalTasks: 1,
        // @ts-expect-error 故意构造非法字段以验证拒绝
        rawMessage: '用户原文',
        messageLengthBucket: 'short',
        policyVersion: 'v1',
      }),
    ).rejects.toThrow(/disallowed_field/i);
    store.close();
  });

  it('policy round-trips via writePolicy / activePolicies', async () => {
    const store = createSqliteSessionStore({ dbPath });
    await store.writePolicy({
      version: 'v-p1',
      createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 50,
    });
    await store.writePolicy({
      version: 'v-p0',
      createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: '{}',
      actionsJson: '{}',
      rolloutPct: 0,
    });
    const active = await store.activePolicies('setSearchTimeout');
    expect(active.map((p) => p.version)).toEqual(['v-p1']);
    store.close();
  });
});
