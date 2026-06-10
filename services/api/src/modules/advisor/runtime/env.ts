export type RuntimeEnv = {
  runtimeEnabled: boolean;
  maxTurns: number;
  maxTasks: number;
  taskMaxRetries: number;
  runtimeTimeoutMs: number;
  routerDEnabled: boolean;
  routerDMode: 'rolling_stats_only' | 'with_policy_table';
  rollingWindowMs: number;
};

function parseBool(value: string | undefined, def: boolean): boolean {
  if (value === undefined) return def;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return def;
}

function parseIntInRange(
  value: string | undefined,
  def: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return def;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return def;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function parseMode(value: string | undefined): RuntimeEnv['routerDMode'] {
  if (value?.trim() === 'with_policy_table') return 'with_policy_table';
  return 'rolling_stats_only';
}

export function readRuntimeEnv(): RuntimeEnv {
  return {
    runtimeEnabled: parseBool(process.env.ADVISOR_RUNTIME_ENABLED, false),
    maxTurns: parseIntInRange(process.env.ADVISOR_MAX_TURNS, 3, 1, 10),
    maxTasks: parseIntInRange(process.env.ADVISOR_MAX_TASKS, 4, 1, 8),
    taskMaxRetries: parseIntInRange(process.env.ADVISOR_TASK_MAX_RETRIES, 1, 0, 3),
    runtimeTimeoutMs: parseIntInRange(
      process.env.ADVISOR_RUNTIME_TIMEOUT_MS,
      60000,
      5000,
      300000,
    ),
    routerDEnabled: parseBool(process.env.ADVISOR_ROUTER_D_ENABLED, false),
    routerDMode: parseMode(process.env.ADVISOR_ROUTER_D_MODE),
    rollingWindowMs: parseIntInRange(
      process.env.ADVISOR_ROLLING_WINDOW_MS,
      300000,
      30000,
      1800000,
    ),
  };
}
