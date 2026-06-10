import {
  isLegalTaskTransition,
  type TaskEvent,
  type TaskState,
} from './state_machine.types';

export type TaskContext = {
  taskId: string;
  title: string;
  needSearch: boolean;
  state: TaskState;
  retryCount: number;
  maxRetries: number;
  lastFailureReason?: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

const EVENT_TO_TARGET: Record<TaskEvent['kind'], TaskState> = {
  pick: 'T_IN_PROGRESS',
  success: 'T_DONE',
  fail: 'T_FAILED',
  retry: 'T_PENDING',
  exceed_retries: 'T_SKIPPED',
};

export function createTaskInitial(params: {
  taskId: string;
  title: string;
  needSearch: boolean;
  maxRetries: number;
}): TaskContext {
  return {
    taskId: params.taskId,
    title: params.title,
    needSearch: params.needSearch,
    state: 'T_PENDING',
    retryCount: 0,
    maxRetries: params.maxRetries,
  };
}

export function applyTaskEvent(ctx: TaskContext, event: TaskEvent): TaskContext {
  const target = EVENT_TO_TARGET[event.kind];
  if (!isLegalTaskTransition(ctx.state, target, event)) {
    throw new Error(
      `illegal task transition: ${ctx.state} --${event.kind}--> ${target}`,
    );
  }
  const now = Date.now();
  const next: TaskContext = { ...ctx, state: target };
  if (event.kind === 'pick' && next.startedAtMs === undefined) {
    next.startedAtMs = now;
  }
  if (event.kind === 'fail') {
    next.lastFailureReason = event.reason;
  }
  if (event.kind === 'retry') {
    next.retryCount = ctx.retryCount + 1;
  }
  if (
    target === 'T_DONE' ||
    target === 'T_SKIPPED'
  ) {
    next.endedAtMs = now;
  }
  return next;
}

export function shouldRetry(task: TaskContext): boolean {
  return task.state === 'T_FAILED' && task.retryCount < task.maxRetries;
}
