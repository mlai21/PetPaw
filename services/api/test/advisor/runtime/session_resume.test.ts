import { runScheduler } from '../../../src/modules/advisor/runtime/scheduler';
import { createMemoryRouterPolicy } from '../../../src/modules/advisor/runtime/router_policy.memory';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';
import type { PlanTask } from '../../../src/modules/advisor/agent_loop/types';

const baseAdapters = (tasks: PlanTask[]) => ({
  intent: async () => ({
    data: { needPlan: true, reason: 'search', directAnswer: '', rawText: '' },
    nextAction: { kind: 'continue' as const },
    trace: { agentName: 'intent' as const, durationMs: 1, model: 'm', skipped: false },
  }),
  planner: async () => ({
    data: { tasks, rawText: '', answerDraft: '' },
    nextAction: { kind: 'continue' as const },
    trace: { agentName: 'planner' as const, durationMs: 1, model: 'm', skipped: false },
  }),
  executor: async () => ({
    data: {
      steps: [
        {
          taskId: 't1',
          title: 'search',
          status: 'done' as const,
          tool: 'tavily-search' as const,
          inputSummary: 'q',
          outputSummary: 'http://x',
        },
      ],
      notes: ['tavily_ok:t1'],
    },
    nextAction: { kind: 'continue' as const },
    trace: {
      agentName: 'executor' as const,
      durationMs: 10,
      model: 'n/a',
      skipped: false,
      toolUsed: 'tavily-search' as const,
      toolResult: 'success' as const,
    },
  }),
  responder: async () => ({
    data: { answer: '答案', rawText: '', userPayload: '' },
    nextAction: { kind: 'continue' as const },
    trace: { agentName: 'responder' as const, durationMs: 1, model: 'm', skipped: false },
  }),
  verify: async () => ({
    data: { answer: '答案', rawText: '', fallback: false },
    nextAction: { kind: 'done' as const, finalAnswer: '答案' },
    trace: { agentName: 'verify' as const, durationMs: 1, model: 'm', skipped: false },
  }),
});

describe('Runtime writes to SessionStore at task boundary', () => {
  it('persists runtime + tasks + stage traces after a successful run', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    const router = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'needs data', needSearch: true }];

    const result = await runScheduler({
      runId: 'run-1',
      sessionId: 'sess-1',
      userMessage: '最新天气怎么样',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: baseAdapters(tasks),
      sessionStore: store,
      keywordCategory: 'weather',
      policyVersion: 'none',
    });

    expect(result.terminalState).toBe('R_COMPLETED');

    const runs = await store.recentRuntimesBySession('sess-1', 5);
    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBe('run-1');
    expect(runs[0].terminalState).toBe('R_COMPLETED');
    expect(runs[0].messageLengthBucket).toBe('short');

    const persistedTasks = await store.tasksByRun('run-1');
    expect(persistedTasks.length).toBeGreaterThanOrEqual(1);
    expect(persistedTasks[0].terminalState).toBe('T_DONE');
    expect(persistedTasks[0].keywordCategory).toBe('weather');

    const stages = await store.stageTracesByRun('run-1');
    expect(stages.length).toBeGreaterThanOrEqual(1);
    expect(stages.some((s) => s.stage === 'verify')).toBe(true);

    store.close();
  });

  it('does not throw when sessionStore is omitted', async () => {
    const router = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'r', needSearch: true }];
    const result = await runScheduler({
      runId: 'run-2',
      sessionId: 'sess-2',
      userMessage: 'q',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: baseAdapters(tasks),
    });
    expect(result.terminalState).toBe('R_COMPLETED');
  });
});
