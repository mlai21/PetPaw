import {
  applyRuntimeEvent,
  createRuntimeInitial,
  type RuntimeContext,
} from './runtime.state_machine';
import { applyTaskEvent, createTaskInitial, shouldRetry, type TaskContext } from './task.state_machine';
import type {
  AgentResult,
  ExecutorData,
  IntentData,
  PlannerData,
  ResponderData,
  VerifyData,
} from './agent_adapter.types';
import type { RouterPolicy } from './router_policy.types';
import type { AgentLoopEvent } from '../agent_loop/types';
import type { SessionStore, StageTraceRow } from '../persistence/session_store.types';

export type SchedulerAdapters = {
  intent(): Promise<AgentResult<IntentData>>;
  planner(): Promise<AgentResult<PlannerData>>;
  executor(params: { tasks: TaskContext[] }): Promise<AgentResult<ExecutorData>>;
  responder(params: { tasks: TaskContext[]; executor: ExecutorData }): Promise<AgentResult<ResponderData>>;
  verify(params: { draft: string }): Promise<AgentResult<VerifyData>>;
};

export type SchedulerInput = {
  runId: string;
  sessionId: string;
  userMessage: string;
  maxTurns: number;
  maxTasks: number;
  taskMaxRetries: number;
  runtimeTimeoutMs: number;
  router: RouterPolicy;
  adapters: SchedulerAdapters;
  onEvent?: (event: AgentLoopEvent) => void;
  sessionStore?: SessionStore;
  keywordCategory?: string | null;
  policyVersion?: string;
};

export type SchedulerResult = {
  runtime: RuntimeContext;
  terminalState: RuntimeContext['state'];
  terminalReason?: string;
  finalAnswer: string;
  totalTurns: number;
  tasks: TaskContext[];
  events: AgentLoopEvent[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function bucketOf(message: string): 'short' | 'medium' | 'long' {
  if (message.length < 20) return 'short';
  if (message.length < 100) return 'medium';
  return 'long';
}

/**
 * 在 Runtime 进入终态时把脱敏 trace 写入 SessionStore。best-effort：
 * 任意写入异常都被吞掉，绝不影响主链路返回的答案。
 */
async function flushRuntime(
  input: SchedulerInput,
  runtime: RuntimeContext,
  tasks: TaskContext[],
  stageTraces: StageTraceRow[],
): Promise<void> {
  const store = input.sessionStore;
  if (!store) return;
  try {
    await store.upsertSession({ sessionId: input.sessionId, userId: 'unknown' });
    await store.writeRuntime({
      runId: input.runId,
      sessionId: input.sessionId,
      startedAtMs: runtime.startedAtMs ?? Date.now(),
      endedAtMs: runtime.endedAtMs ?? Date.now(),
      terminalState: runtime.state as 'R_COMPLETED' | 'R_FAILED' | 'R_ABORTED',
      totalTurns: runtime.turnIndex + 1,
      totalTasks: tasks.length,
      messageLengthBucket: bucketOf(input.userMessage),
      policyVersion: input.policyVersion ?? 'none',
    });
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.state !== 'T_DONE' && t.state !== 'T_SKIPPED' && t.state !== 'T_FAILED') continue;
      await store.writeTask({
        taskId: t.taskId,
        runId: input.runId,
        taskIndex: i,
        terminalState: t.state,
        needSearch: t.needSearch,
        durationMs: (t.endedAtMs ?? Date.now()) - (t.startedAtMs ?? t.endedAtMs ?? Date.now()),
        retryCount: t.retryCount,
        keywordCategory: input.keywordCategory ?? null,
      });
    }
    for (const trace of stageTraces) {
      await store.writeStageTrace(trace);
    }
  } catch (err) {
    console.warn(
      '[advisor][session_store_flush_failed]',
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function runScheduler(input: SchedulerInput): Promise<SchedulerResult> {
  const events: AgentLoopEvent[] = [];
  const recordEvent = (e: Omit<AgentLoopEvent, 'runId' | 'timestamp'>) => {
    const event: AgentLoopEvent = { runId: input.runId, timestamp: nowIso(), ...e };
    events.push(event);
    input.onEvent?.(event);
  };

  const stageTraces: StageTraceRow[] = [];
  let stageSeq = 0;
  const recordStage = (
    stage: StageTraceRow['stage'],
    durationMs: number,
    outcome: StageTraceRow['outcome'],
  ) => {
    stageTraces.push({
      traceId: `${input.runId}-${stage}-${stageSeq++}`,
      runId: input.runId,
      stage,
      durationMs: Math.max(0, Math.round(durationMs)),
      outcome,
    });
  };

  let runtime = createRuntimeInitial({ runId: input.runId, sessionId: input.sessionId });
  runtime = applyRuntimeEvent(runtime, { kind: 'start' });
  recordEvent({ event: 'runtime_start', stage: 'loop', status: 'running' });

  const finalize = async (result: SchedulerResult): Promise<SchedulerResult> => {
    await flushRuntime(input, result.runtime, result.tasks, stageTraces);
    return result;
  };

  const intentResult = await input.adapters.intent();
  recordStage(
    'intent',
    intentResult.trace.durationMs,
    intentResult.nextAction.kind === 'abort' ? 'fail' : 'pass',
  );
  if (intentResult.nextAction.kind === 'done') {
    runtime = applyRuntimeEvent(runtime, { kind: 'all_tasks_done' });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'completed', endState: 'completed' });
    return finalize({
      runtime,
      terminalState: runtime.state,
      finalAnswer: intentResult.nextAction.finalAnswer,
      totalTurns: 0,
      tasks: [],
      events,
    });
  }
  if (intentResult.nextAction.kind === 'abort') {
    runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: intentResult.nextAction.reason });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: intentResult.nextAction.reason });
    return finalize({ runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: 0, tasks: [], events });
  }

  let tasks: TaskContext[] = [];
  let finalAnswer = '';
  for (let turn = 0; turn < input.maxTurns; turn++) {
    runtime.turnIndex = turn;
    recordEvent({ event: 'turn_start', stage: 'loop', status: 'running' });

    const plannerResult = await input.adapters.planner();
    recordStage(
      'planner',
      plannerResult.trace.durationMs,
      plannerResult.nextAction.kind === 'abort' ? 'fail' : 'pass',
    );
    if (plannerResult.nextAction.kind === 'abort') {
      runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: plannerResult.nextAction.reason });
      recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: plannerResult.nextAction.reason });
      return finalize({ runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: turn + 1, tasks, events });
    }
    const cappedPlanned = plannerResult.data.tasks.slice(0, input.maxTasks);
    tasks = cappedPlanned.map((t) =>
      createTaskInitial({ taskId: t.id, title: t.title, needSearch: t.needSearch, maxRetries: input.taskMaxRetries }),
    );

    const executorResult = await input.adapters.executor({ tasks });
    recordStage(
      'executor',
      executorResult.trace.durationMs,
      executorResult.data.steps.some((s) => s.status === 'failed')
        ? 'fail'
        : executorResult.data.steps.some((s) => s.status === 'done')
          ? 'pass'
          : 'skip',
    );
    for (const step of executorResult.data.steps) {
      const idx = tasks.findIndex((t) => t.taskId === step.taskId);
      if (idx < 0) continue;
      tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'pick' });
      if (step.status === 'done' || step.status === 'skipped') {
        tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'success' });
        recordEvent({ event: 'task_done', stage: 'executor', status: 'completed', taskIndex: idx });
      } else {
        tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'fail', reason: step.outputSummary.slice(0, 80) });
        recordEvent({ event: 'task_failed', stage: 'executor', status: 'failed', taskIndex: idx, failureReason: step.outputSummary.slice(0, 80) });
      }
    }
    input.router.recordSignal({
      toolResult:
        executorResult.data.steps.some((s) => s.status === 'failed') ? 'fail' :
        executorResult.data.steps.some((s) => s.status === 'done') ? 'success' : 'empty',
    });

    if (executorResult.nextAction.kind === 'retry_task') {
      const failedIdx = tasks.findIndex((t) => t.state === 'T_FAILED' && shouldRetry(t));
      if (failedIdx >= 0) {
        tasks[failedIdx] = applyTaskEvent(tasks[failedIdx], { kind: 'retry' });
        recordEvent({ event: 'task_retried', stage: 'executor', status: 'running', taskIndex: failedIdx });
      } else {
        // 重试额度耗尽：标记 SKIPPED，后续 turn 由 planner 决定是否换路
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].state === 'T_FAILED') {
            tasks[i] = applyTaskEvent(tasks[i], { kind: 'exceed_retries' });
            recordEvent({ event: 'task_skipped', stage: 'executor', status: 'failed', taskIndex: i });
          }
        }
      }
      recordEvent({ event: 'turn_complete', stage: 'loop', status: 'running' });
      continue;
    }

    const responderResult = await input.adapters.responder({ tasks, executor: executorResult.data });
    recordStage(
      'responder',
      responderResult.trace.durationMs,
      responderResult.nextAction.kind === 'abort' ? 'fail' : 'pass',
    );
    if (responderResult.nextAction.kind === 'abort') {
      runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: responderResult.nextAction.reason });
      recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: responderResult.nextAction.reason });
      return finalize({ runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: turn + 1, tasks, events });
    }
    finalAnswer = responderResult.data.answer;

    const verifyResult = await input.adapters.verify({ draft: responderResult.data.answer });
    recordStage(
      'verify',
      verifyResult.trace.durationMs,
      verifyResult.trace.skipped ? 'skip' : verifyResult.data.fallback ? 'fail' : 'pass',
    );
    input.router.recordSignal({ verifyOutcome: verifyResult.data.fallback ? 'fail' : 'pass' });
    if (verifyResult.nextAction.kind === 'done') {
      finalAnswer = verifyResult.nextAction.finalAnswer;
    }

    runtime = applyRuntimeEvent(runtime, { kind: 'all_tasks_done' });
    recordEvent({ event: 'turn_complete', stage: 'loop', status: 'completed' });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'completed', endState: 'completed' });
    return finalize({ runtime, terminalState: runtime.state, finalAnswer, totalTurns: turn + 1, tasks, events });
  }

  runtime = applyRuntimeEvent(runtime, { kind: 'max_turns_exceeded' });
  recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: 'max_turns_exceeded' });
  return finalize({ runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer, totalTurns: input.maxTurns, tasks, events });
}
