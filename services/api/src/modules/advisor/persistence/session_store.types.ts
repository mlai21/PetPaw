export type SessionRow = {
  sessionId: string;
  userId: string;
  createdAt?: number;
  lastActiveAt?: number;
  messageCount?: number;
};

export type RuntimeRow = {
  runId: string;
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  terminalState: 'R_COMPLETED' | 'R_FAILED' | 'R_ABORTED';
  totalTurns: number;
  totalTasks: number;
  messageLengthBucket: 'short' | 'medium' | 'long';
  policyVersion: string;
};

export type TaskRow = {
  taskId: string;
  runId: string;
  taskIndex: number;
  terminalState: 'T_DONE' | 'T_FAILED' | 'T_SKIPPED';
  needSearch: boolean;
  toolUsed?: 'tavily-search' | 'x-search' | 'bailian-search' | 'none';
  toolResult?: 'success' | 'fail' | 'empty';
  durationMs: number;
  retryCount: number;
  keywordCategory?: string | null;
};

export type StageTraceRow = {
  traceId: string;
  runId: string;
  stage: 'intent' | 'planner' | 'executor' | 'responder' | 'verify';
  durationMs: number;
  outcome: 'pass' | 'fail' | 'skip';
};

export type PolicyRow = {
  version: string;
  createdAt: number;
  scope: string;
  conditionsJson: string;
  actionsJson: string;
  rolloutPct: number;
};

export interface SessionStore {
  upsertSession(row: SessionRow): Promise<void>;
  writeRuntime(row: RuntimeRow): Promise<void>;
  writeTask(row: TaskRow): Promise<void>;
  writeStageTrace(row: StageTraceRow): Promise<void>;
  recentRuntimesBySession(sessionId: string, limit: number): Promise<RuntimeRow[]>;
  tasksByRun(runId: string): Promise<TaskRow[]>;
  stageTracesByRun(runId: string): Promise<StageTraceRow[]>;
  activePolicies(scope: string): Promise<PolicyRow[]>;
  writePolicy(row: PolicyRow): Promise<void>;
  pruneOldRecords(): Promise<void>;
  /** D-Learner 训练取数：返回 startedAt >= sinceMs 的 runtime 及其关联 task。 */
  trainingData(sinceMs: number): Promise<{ runtimes: RuntimeRow[]; tasks: TaskRow[] }>;
  close(): void;
}

const DISALLOWED_FIELDS = new Set(['rawMessage', 'rawAnswer', 'phoneNumber', 'email', 'url', 'urls']);

export function assertNoDisallowedFields(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (DISALLOWED_FIELDS.has(key)) {
      throw new Error(`disallowed_field:${key}`);
    }
  }
}
