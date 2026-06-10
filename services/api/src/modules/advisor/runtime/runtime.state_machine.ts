import {
  isLegalRuntimeTransition,
  type RuntimeEvent,
  type RuntimeState,
} from './state_machine.types';

export type RuntimeContext = {
  runId: string;
  sessionId: string;
  state: RuntimeState;
  turnIndex: number;
  startedAtMs?: number;
  endedAtMs?: number;
  terminalReason?: string;
};

const EVENT_TO_TARGET: Record<RuntimeEvent['kind'], RuntimeState> = {
  start: 'R_RUNNING',
  all_tasks_done: 'R_COMPLETED',
  critical_fail: 'R_FAILED',
  max_turns_exceeded: 'R_FAILED',
  user_abort: 'R_ABORTED',
  runtime_timeout: 'R_FAILED',
};

export function createRuntimeInitial(params: {
  runId: string;
  sessionId: string;
}): RuntimeContext {
  return {
    runId: params.runId,
    sessionId: params.sessionId,
    state: 'R_IDLE',
    turnIndex: 0,
  };
}

export function applyRuntimeEvent(
  ctx: RuntimeContext,
  event: RuntimeEvent,
): RuntimeContext {
  const target = EVENT_TO_TARGET[event.kind];
  if (!isLegalRuntimeTransition(ctx.state, target, event)) {
    throw new Error(
      `illegal runtime transition: ${ctx.state} --${event.kind}--> ${target}`,
    );
  }
  const now = Date.now();
  const next: RuntimeContext = { ...ctx, state: target };
  if (event.kind === 'start') {
    next.startedAtMs = now;
  }
  if (
    target === 'R_COMPLETED' ||
    target === 'R_FAILED' ||
    target === 'R_ABORTED'
  ) {
    next.endedAtMs = now;
  }
  if (event.kind === 'critical_fail') {
    next.terminalReason = `critical_fail:${event.reason}`;
  } else if (event.kind === 'max_turns_exceeded') {
    next.terminalReason = 'max_turns_exceeded';
  } else if (event.kind === 'user_abort') {
    next.terminalReason = 'user_abort';
  } else if (event.kind === 'runtime_timeout') {
    next.terminalReason = 'runtime_timeout';
  }
  return next;
}
