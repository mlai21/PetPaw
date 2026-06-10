import {
  createTaskInitial,
  applyTaskEvent,
} from '../../../src/modules/advisor/runtime/task.state_machine';

describe('Task state machine reducer', () => {
  const baseTask = { taskId: 't-1', title: 'search weather', needSearch: true };

  it('starts at T_PENDING with retryCount=0', () => {
    const t = createTaskInitial({ ...baseTask, maxRetries: 1 });
    expect(t.state).toBe('T_PENDING');
    expect(t.retryCount).toBe(0);
  });

  it('T_PENDING -> T_IN_PROGRESS via pick', () => {
    const t = applyTaskEvent(
      createTaskInitial({ ...baseTask, maxRetries: 1 }),
      { kind: 'pick' },
    );
    expect(t.state).toBe('T_IN_PROGRESS');
  });

  it('T_IN_PROGRESS -> T_DONE via success', () => {
    const t = applyTaskEvent(
      applyTaskEvent(
        createTaskInitial({ ...baseTask, maxRetries: 1 }),
        { kind: 'pick' },
      ),
      { kind: 'success' },
    );
    expect(t.state).toBe('T_DONE');
  });

  it('T_IN_PROGRESS -> T_FAILED via fail, retry returns to T_PENDING and increments retryCount', () => {
    const failed = applyTaskEvent(
      applyTaskEvent(
        createTaskInitial({ ...baseTask, maxRetries: 1 }),
        { kind: 'pick' },
      ),
      { kind: 'fail', reason: 'tool_timeout' },
    );
    expect(failed.state).toBe('T_FAILED');
    expect(failed.lastFailureReason).toBe('tool_timeout');
    const retried = applyTaskEvent(failed, { kind: 'retry' });
    expect(retried.state).toBe('T_PENDING');
    expect(retried.retryCount).toBe(1);
  });

  it('T_FAILED -> T_SKIPPED via exceed_retries when retryCount reaches maxRetries', () => {
    let t = createTaskInitial({ ...baseTask, maxRetries: 1 });
    t = applyTaskEvent(t, { kind: 'pick' });
    t = applyTaskEvent(t, { kind: 'fail', reason: 'r1' });
    t = applyTaskEvent(t, { kind: 'retry' });
    t = applyTaskEvent(t, { kind: 'pick' });
    t = applyTaskEvent(t, { kind: 'fail', reason: 'r2' });
    t = applyTaskEvent(t, { kind: 'exceed_retries' });
    expect(t.state).toBe('T_SKIPPED');
  });

  it('throws on illegal transition (T_DONE -> pick)', () => {
    let t = createTaskInitial({ ...baseTask, maxRetries: 1 });
    t = applyTaskEvent(t, { kind: 'pick' });
    t = applyTaskEvent(t, { kind: 'success' });
    expect(() => applyTaskEvent(t, { kind: 'pick' })).toThrow(/illegal task transition/i);
  });
});
