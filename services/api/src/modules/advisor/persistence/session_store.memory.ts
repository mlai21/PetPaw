import {
  assertNoDisallowedFields,
  type PolicyRow,
  type RuntimeRow,
  type SessionRow,
  type SessionStore,
  type StageTraceRow,
  type TaskRow,
} from './session_store.types';

/**
 * 纯内存实现的 SessionStore，用于单测与 SQLite 初始化失败时的降级。
 * 接口语义与 SQLite 版一致（含 PII 防御与保留策略）。
 */
export function createMemorySessionStore(params: { retentionDays?: number } = {}): SessionStore {
  const retentionDays = params.retentionDays ?? 90;
  const sessions = new Map<string, SessionRow>();
  const runtimes: RuntimeRow[] = [];
  const tasks: TaskRow[] = [];
  const stageTraces: StageTraceRow[] = [];
  const policies: PolicyRow[] = [];

  return {
    async upsertSession(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      const now = Date.now();
      const existing = sessions.get(row.sessionId);
      if (existing) {
        existing.lastActiveAt = now;
        existing.messageCount = (existing.messageCount ?? 0) + 1;
      } else {
        sessions.set(row.sessionId, {
          sessionId: row.sessionId,
          userId: row.userId,
          createdAt: now,
          lastActiveAt: now,
          messageCount: 0,
        });
      }
    },
    async writeRuntime(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      runtimes.push({ ...row });
    },
    async writeTask(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      tasks.push({ ...row, keywordCategory: row.keywordCategory ?? null });
    },
    async writeStageTrace(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      stageTraces.push({ ...row });
    },
    async recentRuntimesBySession(sessionId, limit) {
      return runtimes
        .filter((r) => r.sessionId === sessionId)
        .sort((a, b) => b.startedAtMs - a.startedAtMs)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
    async tasksByRun(runId) {
      return tasks
        .filter((t) => t.runId === runId)
        .sort((a, b) => a.taskIndex - b.taskIndex)
        .map((t) => ({ ...t }));
    },
    async stageTracesByRun(runId) {
      return stageTraces.filter((s) => s.runId === runId).map((s) => ({ ...s }));
    },
    async activePolicies(scope) {
      return policies
        .filter((p) => p.scope === scope && p.rolloutPct > 0)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => ({ ...p }));
    },
    async writePolicy(row) {
      policies.push({ ...row });
    },
    async pruneOldRecords() {
      const cutoff = Date.now() - retentionDays * 86400000;
      for (let i = runtimes.length - 1; i >= 0; i--) {
        if (runtimes[i].startedAtMs < cutoff) runtimes.splice(i, 1);
      }
      const liveRunIds = new Set(runtimes.map((r) => r.runId));
      for (let i = tasks.length - 1; i >= 0; i--) {
        if (!liveRunIds.has(tasks[i].runId)) tasks.splice(i, 1);
      }
      for (let i = stageTraces.length - 1; i >= 0; i--) {
        if (!liveRunIds.has(stageTraces[i].runId)) stageTraces.splice(i, 1);
      }
    },
    close() {
      sessions.clear();
      runtimes.length = 0;
      tasks.length = 0;
      stageTraces.length = 0;
      policies.length = 0;
    },
  };
}
