export const RUNTIME_STATES = [
  'R_IDLE',
  'R_RUNNING',
  'R_COMPLETED',
  'R_FAILED',
  'R_ABORTED',
] as const;

export type RuntimeState = (typeof RUNTIME_STATES)[number];
export type RuntimeTerminalState = Extract<
  RuntimeState,
  'R_COMPLETED' | 'R_FAILED' | 'R_ABORTED'
>;

export const TASK_STATES = [
  'T_PENDING',
  'T_IN_PROGRESS',
  'T_DONE',
  'T_FAILED',
  'T_SKIPPED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];
export type TaskTerminalState = Extract<TaskState, 'T_DONE' | 'T_FAILED' | 'T_SKIPPED'>;

export type RuntimeEvent =
  | { kind: 'start' }
  | { kind: 'all_tasks_done' }
  | { kind: 'critical_fail'; reason: string }
  | { kind: 'max_turns_exceeded' }
  | { kind: 'user_abort' }
  | { kind: 'runtime_timeout' };

export type TaskEvent =
  | { kind: 'pick' }
  | { kind: 'success' }
  | { kind: 'fail'; reason: string }
  | { kind: 'retry' }
  | { kind: 'exceed_retries' };

const RUNTIME_TRANSITIONS: Record<RuntimeState, Partial<Record<RuntimeEvent['kind'], RuntimeState>>> = {
  R_IDLE: { start: 'R_RUNNING' },
  R_RUNNING: {
    all_tasks_done: 'R_COMPLETED',
    critical_fail: 'R_FAILED',
    max_turns_exceeded: 'R_FAILED',
    user_abort: 'R_ABORTED',
    runtime_timeout: 'R_FAILED',
  },
  R_COMPLETED: {},
  R_FAILED: {},
  R_ABORTED: {},
};

const TASK_TRANSITIONS: Record<TaskState, Partial<Record<TaskEvent['kind'], TaskState>>> = {
  T_PENDING: { pick: 'T_IN_PROGRESS' },
  T_IN_PROGRESS: {
    success: 'T_DONE',
    fail: 'T_FAILED',
  },
  T_FAILED: {
    retry: 'T_PENDING',
    exceed_retries: 'T_SKIPPED',
  },
  T_DONE: {},
  T_SKIPPED: {},
};

export function isLegalRuntimeTransition(
  from: RuntimeState,
  to: RuntimeState,
  event: RuntimeEvent,
): boolean {
  return RUNTIME_TRANSITIONS[from][event.kind] === to;
}

export function isLegalTaskTransition(
  from: TaskState,
  to: TaskState,
  event: TaskEvent,
): boolean {
  return TASK_TRANSITIONS[from][event.kind] === to;
}
