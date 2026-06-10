import { readRuntimeEnv } from '../../../src/modules/advisor/runtime/env';

describe('readRuntimeEnv', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when no env set', () => {
    delete process.env.ADVISOR_RUNTIME_ENABLED;
    delete process.env.ADVISOR_MAX_TURNS;
    delete process.env.ADVISOR_MAX_TASKS;
    delete process.env.ADVISOR_TASK_MAX_RETRIES;
    delete process.env.ADVISOR_RUNTIME_TIMEOUT_MS;
    delete process.env.ADVISOR_ROUTER_D_ENABLED;
    delete process.env.ADVISOR_ROUTER_D_MODE;
    delete process.env.ADVISOR_ROLLING_WINDOW_MS;
    const env = readRuntimeEnv();
    expect(env.runtimeEnabled).toBe(false);
    expect(env.maxTurns).toBe(3);
    expect(env.maxTasks).toBe(4);
    expect(env.taskMaxRetries).toBe(1);
    expect(env.runtimeTimeoutMs).toBe(60000);
    expect(env.routerDEnabled).toBe(false);
    expect(env.routerDMode).toBe('rolling_stats_only');
    expect(env.rollingWindowMs).toBe(300000);
  });

  it('parses ADVISOR_RUNTIME_ENABLED=true', () => {
    process.env.ADVISOR_RUNTIME_ENABLED = 'true';
    expect(readRuntimeEnv().runtimeEnabled).toBe(true);
  });

  it('clamps maxTurns to [1, 10]', () => {
    process.env.ADVISOR_MAX_TURNS = '99';
    expect(readRuntimeEnv().maxTurns).toBe(10);
    process.env.ADVISOR_MAX_TURNS = '0';
    expect(readRuntimeEnv().maxTurns).toBe(1);
  });

  it('falls back to default on invalid number', () => {
    process.env.ADVISOR_RUNTIME_TIMEOUT_MS = 'not-a-number';
    expect(readRuntimeEnv().runtimeTimeoutMs).toBe(60000);
  });
});
