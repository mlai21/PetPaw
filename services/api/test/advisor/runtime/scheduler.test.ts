import { runScheduler } from '../../../src/modules/advisor/runtime/scheduler';
import { createMemoryRouterPolicy } from '../../../src/modules/advisor/runtime/router_policy.memory';
import type { PlanTask } from '../../../src/modules/advisor/agent_loop/types';

describe('Scheduler (E.1) - turn loop and task retry', () => {
  const router = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });

  it('finishes at R_COMPLETED when intent says direct answer', async () => {
    const result = await runScheduler({
      runId: 'r1',
      sessionId: 's1',
      userMessage: '你好',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: false, reason: 'fast', directAnswer: '你好', rawText: '' },
          nextAction: { kind: 'done', finalAnswer: '你好' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => { throw new Error('should not be called'); },
        executor: async () => { throw new Error('should not be called'); },
        responder: async () => { throw new Error('should not be called'); },
        verify: async () => { throw new Error('should not be called'); },
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(result.finalAnswer).toBe('你好');
    expect(result.totalTurns).toBe(0);
  });

  it('runs full pipeline when intent needPlan=true', async () => {
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'needs data', needSearch: true }];
    const result = await runScheduler({
      runId: 'r2',
      sessionId: 's2',
      userMessage: '最新天气',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'search', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => ({
          data: {
            steps: [{ taskId: 't1', title: 'search', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'http://x' }],
            notes: ['tavily_ok:t1'],
          },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'executor', durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'tavily-search', toolResult: 'success' },
        }),
        responder: async () => ({
          data: { answer: '答案', rawText: '', userPayload: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'responder', durationMs: 1, model: 'm', skipped: false },
        }),
        verify: async () => ({
          data: { answer: '答案', rawText: '', fallback: false },
          nextAction: { kind: 'done', finalAnswer: '答案' },
          trace: { agentName: 'verify', durationMs: 1, model: 'm', skipped: false },
        }),
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(result.finalAnswer).toBe('答案');
    expect(result.totalTurns).toBe(1);
  });

  it('retries task on executor failure within maxRetries, then proceeds', async () => {
    let executorCalls = 0;
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'r', needSearch: true }];
    const result = await runScheduler({
      runId: 'r3',
      sessionId: 's3',
      userMessage: 'q',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'r', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => {
          executorCalls += 1;
          if (executorCalls === 1) {
            return {
              data: { steps: [{ taskId: 't1', title: 'search', status: 'failed' as const, tool: 'bailian-search' as const, inputSummary: 'q', outputSummary: 'timeout' }], notes: ['bailian_failed:t1:timeout'] },
              nextAction: { kind: 'retry_task' as const, taskId: 't1' },
              trace: { agentName: 'executor' as const, durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'bailian-search' as const, toolResult: 'fail' as const },
            };
          }
          return {
            data: { steps: [{ taskId: 't1', title: 'search', status: 'done' as const, tool: 'tavily-search' as const, inputSummary: 'q', outputSummary: 'http://x' }], notes: ['tavily_ok:t1'] },
            nextAction: { kind: 'continue' as const },
            trace: { agentName: 'executor' as const, durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'tavily-search' as const, toolResult: 'success' as const },
          };
        },
        responder: async () => ({
          data: { answer: '最终答', rawText: '', userPayload: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'responder', durationMs: 1, model: 'm', skipped: false },
        }),
        verify: async () => ({
          data: { answer: '最终答', rawText: '', fallback: false },
          nextAction: { kind: 'done', finalAnswer: '最终答' },
          trace: { agentName: 'verify', durationMs: 1, model: 'm', skipped: false },
        }),
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(executorCalls).toBe(2);
  });

  it('returns R_FAILED on maxTurns exceeded', async () => {
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'r', needSearch: true }];
    const result = await runScheduler({
      runId: 'r4',
      sessionId: 's4',
      userMessage: 'q',
      maxTurns: 1,
      maxTasks: 4,
      taskMaxRetries: 0,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'r', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => ({
          data: { steps: [{ taskId: 't1', title: 'search', status: 'failed' as const, tool: 'bailian-search' as const, inputSummary: 'q', outputSummary: 'always fail' }], notes: ['bailian_failed:t1:x'] },
          nextAction: { kind: 'retry_task' as const, taskId: 't1' },
          trace: { agentName: 'executor', durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'bailian-search' as const, toolResult: 'fail' as const },
        }),
        responder: async () => { throw new Error('not reached'); },
        verify: async () => { throw new Error('not reached'); },
      },
    });
    expect(result.terminalState).toBe('R_FAILED');
    expect(result.terminalReason).toMatch(/max_turns/);
  });
});
