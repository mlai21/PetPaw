import {
  RUNTIME_STATES,
  TASK_STATES,
  isLegalRuntimeTransition,
  isLegalTaskTransition,
} from '../../../src/modules/advisor/runtime/state_machine.types';

describe('Runtime / Task state machine types', () => {
  it('exports the 5 runtime states', () => {
    expect(RUNTIME_STATES).toEqual([
      'R_IDLE',
      'R_RUNNING',
      'R_COMPLETED',
      'R_FAILED',
      'R_ABORTED',
    ]);
  });

  it('exports the 5 task states', () => {
    expect(TASK_STATES).toEqual([
      'T_PENDING',
      'T_IN_PROGRESS',
      'T_DONE',
      'T_FAILED',
      'T_SKIPPED',
    ]);
  });

  it('allows R_IDLE -> R_RUNNING via start event', () => {
    expect(isLegalRuntimeTransition('R_IDLE', 'R_RUNNING', { kind: 'start' })).toBe(true);
  });

  it('rejects R_COMPLETED -> R_RUNNING (terminal state)', () => {
    expect(isLegalRuntimeTransition('R_COMPLETED', 'R_RUNNING', { kind: 'start' })).toBe(false);
  });

  it('allows T_FAILED -> T_PENDING via retry event', () => {
    expect(isLegalTaskTransition('T_FAILED', 'T_PENDING', { kind: 'retry' })).toBe(true);
  });

  it('rejects T_DONE -> T_PENDING (terminal state)', () => {
    expect(isLegalTaskTransition('T_DONE', 'T_PENDING', { kind: 'retry' })).toBe(false);
  });
});
