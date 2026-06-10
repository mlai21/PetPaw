import type {
  AgentResult,
  AgentTrace,
  ExecutorData,
  IntentData,
  PlannerData,
  ResponderData,
  VerifyData,
} from './agent_adapter.types';

type TraceBase = { durationMs: number; model: string };

function makeTrace(
  agentName: AgentTrace['agentName'],
  base: TraceBase,
  extras: Partial<AgentTrace> = {},
): AgentTrace {
  return {
    agentName,
    durationMs: base.durationMs,
    model: base.model,
    skipped: false,
    ...extras,
  };
}

export function adaptIntent(
  data: IntentData & { rawText: string },
  trace: TraceBase,
): AgentResult<IntentData> {
  if (!data.needPlan && data.directAnswer.trim().length > 0) {
    return {
      data,
      nextAction: { kind: 'done', finalAnswer: data.directAnswer },
      trace: makeTrace('intent', trace),
    };
  }
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('intent', trace),
  };
}

export function adaptPlanner(
  data: PlannerData,
  trace: TraceBase,
): AgentResult<PlannerData> {
  if (data.tasks.length === 0) {
    return {
      data,
      nextAction: { kind: 'abort', reason: 'planner_no_tasks' },
      trace: makeTrace('planner', trace),
    };
  }
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('planner', trace),
  };
}

export function adaptExecutor(
  data: ExecutorData,
  trace: TraceBase,
): AgentResult<ExecutorData> {
  const firstFailed = data.steps.find((step) => step.status === 'failed');
  if (firstFailed) {
    return {
      data,
      nextAction: { kind: 'retry_task', taskId: firstFailed.taskId },
      trace: makeTrace('executor', trace, {
        toolUsed: firstFailed.tool,
        toolResult: 'fail',
      }),
    };
  }
  const firstDone = data.steps.find((step) => step.status === 'done');
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('executor', trace, {
      toolUsed: firstDone?.tool,
      toolResult: firstDone ? 'success' : 'empty',
    }),
  };
}

export function adaptResponder(
  data: ResponderData,
  trace: TraceBase,
): AgentResult<ResponderData> {
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('responder', trace),
  };
}

export function adaptVerify(
  data: VerifyData,
  trace: TraceBase,
): AgentResult<VerifyData> {
  return {
    data,
    nextAction: { kind: 'done', finalAnswer: data.answer },
    trace: makeTrace('verify', trace, {
      skipped: data.fallback,
      reason: data.fallback ? 'verify-fallback' : undefined,
    }),
  };
}
