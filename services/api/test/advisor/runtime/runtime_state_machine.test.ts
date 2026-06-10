import {
  createRuntimeInitial,
  applyRuntimeEvent,
} from '../../../src/modules/advisor/runtime/runtime.state_machine';

describe('Runtime state machine reducer', () => {
  it('initializes at R_IDLE with no terminal reason', () => {
    const r = createRuntimeInitial({ runId: 'run-1', sessionId: 's-1' });
    expect(r.state).toBe('R_IDLE');
    expect(r.terminalReason).toBeUndefined();
    expect(r.runId).toBe('run-1');
  });

  it('transitions R_IDLE -> R_RUNNING on start', () => {
    const r = createRuntimeInitial({ runId: 'run-1', sessionId: 's-1' });
    const next = applyRuntimeEvent(r, { kind: 'start' });
    expect(next.state).toBe('R_RUNNING');
    expect(next.startedAtMs).toBeGreaterThan(0);
  });

  it('transitions R_RUNNING -> R_COMPLETED on all_tasks_done and records endedAt', () => {
    const r = applyRuntimeEvent(
      createRuntimeInitial({ runId: 'run-1', sessionId: 's-1' }),
      { kind: 'start' },
    );
    const next = applyRuntimeEvent(r, { kind: 'all_tasks_done' });
    expect(next.state).toBe('R_COMPLETED');
    expect(next.endedAtMs).toBeGreaterThanOrEqual(r.startedAtMs!);
  });

  it('transitions R_RUNNING -> R_FAILED on max_turns_exceeded with reason', () => {
    const r = applyRuntimeEvent(
      createRuntimeInitial({ runId: 'run-1', sessionId: 's-1' }),
      { kind: 'start' },
    );
    const next = applyRuntimeEvent(r, { kind: 'max_turns_exceeded' });
    expect(next.state).toBe('R_FAILED');
    expect(next.terminalReason).toBe('max_turns_exceeded');
  });

  it('throws on illegal transition (R_COMPLETED -> start)', () => {
    const r = applyRuntimeEvent(
      applyRuntimeEvent(
        createRuntimeInitial({ runId: 'run-1', sessionId: 's-1' }),
        { kind: 'start' },
      ),
      { kind: 'all_tasks_done' },
    );
    expect(() => applyRuntimeEvent(r, { kind: 'start' })).toThrow(
      /illegal runtime transition/i,
    );
  });
});
