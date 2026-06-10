import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migration_runner';
import {
  assertNoDisallowedFields,
  type RuntimeRow,
  type SessionStore,
  type StageTraceRow,
  type TaskRow,
} from './session_store.types';

export function createSqliteSessionStore(params: {
  dbPath: string;
  retentionDays?: number;
}): SessionStore {
  if (params.dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(params.dbPath), { recursive: true });
  }
  const db = new Database(params.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);

  const retentionDays = params.retentionDays ?? 90;

  const upsertSessionStmt = db.prepare(`
    INSERT INTO advisor_sessions(session_id, user_id, created_at, last_active_at, message_count)
    VALUES (@sessionId, @userId, @nowMs, @nowMs, 0)
    ON CONFLICT(session_id) DO UPDATE SET last_active_at = @nowMs, message_count = message_count + 1
  `);
  const writeRuntimeStmt = db.prepare(`
    INSERT INTO advisor_runtimes(run_id, session_id, started_at, ended_at, terminal_state, total_turns, total_tasks, message_length_bucket, policy_version)
    VALUES (@runId, @sessionId, @startedAtMs, @endedAtMs, @terminalState, @totalTurns, @totalTasks, @messageLengthBucket, @policyVersion)
  `);
  const writeTaskStmt = db.prepare(`
    INSERT INTO advisor_tasks(task_id, run_id, task_index, terminal_state, need_search, tool_used, tool_result, duration_ms, retry_count, keyword_category)
    VALUES (@taskId, @runId, @taskIndex, @terminalState, @needSearch, @toolUsed, @toolResult, @durationMs, @retryCount, @keywordCategory)
  `);
  const writeStageTraceStmt = db.prepare(`
    INSERT INTO advisor_stage_traces(trace_id, run_id, stage, duration_ms, outcome)
    VALUES (@traceId, @runId, @stage, @durationMs, @outcome)
  `);
  const recentRuntimesStmt = db.prepare(`
    SELECT run_id, session_id, started_at, ended_at, terminal_state, total_turns, total_tasks, message_length_bucket, policy_version
    FROM advisor_runtimes WHERE session_id = ? ORDER BY started_at DESC LIMIT ?
  `);
  const tasksByRunStmt = db.prepare(`SELECT * FROM advisor_tasks WHERE run_id = ? ORDER BY task_index`);
  const stageTracesByRunStmt = db.prepare(`SELECT * FROM advisor_stage_traces WHERE run_id = ?`);
  const activePoliciesStmt = db.prepare(
    `SELECT * FROM advisor_policies WHERE scope = ? AND rollout_pct > 0 ORDER BY created_at DESC`,
  );
  const writePolicyStmt = db.prepare(`
    INSERT INTO advisor_policies(version, created_at, scope, conditions_json, actions_json, rollout_pct)
    VALUES (@version, @createdAt, @scope, @conditionsJson, @actionsJson, @rolloutPct)
  `);
  const pruneRuntimesStmt = db.prepare(`DELETE FROM advisor_runtimes WHERE started_at < ?`);
  const pruneTasksStmt = db.prepare(
    `DELETE FROM advisor_tasks WHERE run_id NOT IN (SELECT run_id FROM advisor_runtimes)`,
  );
  const pruneStageTracesStmt = db.prepare(
    `DELETE FROM advisor_stage_traces WHERE run_id NOT IN (SELECT run_id FROM advisor_runtimes)`,
  );

  return {
    async upsertSession(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      upsertSessionStmt.run({ sessionId: row.sessionId, userId: row.userId, nowMs: Date.now() });
    },
    async writeRuntime(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeRuntimeStmt.run({
        runId: row.runId,
        sessionId: row.sessionId,
        startedAtMs: row.startedAtMs,
        endedAtMs: row.endedAtMs,
        terminalState: row.terminalState,
        totalTurns: row.totalTurns,
        totalTasks: row.totalTasks,
        messageLengthBucket: row.messageLengthBucket,
        policyVersion: row.policyVersion,
      });
    },
    async writeTask(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeTaskStmt.run({
        taskId: row.taskId,
        runId: row.runId,
        taskIndex: row.taskIndex,
        terminalState: row.terminalState,
        needSearch: row.needSearch ? 1 : 0,
        toolUsed: row.toolUsed ?? null,
        toolResult: row.toolResult ?? null,
        durationMs: row.durationMs,
        retryCount: row.retryCount,
        keywordCategory: row.keywordCategory ?? null,
      });
    },
    async writeStageTrace(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeStageTraceStmt.run(row);
    },
    async recentRuntimesBySession(sessionId, limit) {
      const rows = recentRuntimesStmt.all(sessionId, limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        runId: r.run_id as string,
        sessionId: r.session_id as string,
        startedAtMs: r.started_at as number,
        endedAtMs: r.ended_at as number,
        terminalState: r.terminal_state as RuntimeRow['terminalState'],
        totalTurns: r.total_turns as number,
        totalTasks: r.total_tasks as number,
        messageLengthBucket: r.message_length_bucket as RuntimeRow['messageLengthBucket'],
        policyVersion: r.policy_version as string,
      }));
    },
    async tasksByRun(runId) {
      const rows = tasksByRunStmt.all(runId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        taskId: r.task_id as string,
        runId: r.run_id as string,
        taskIndex: r.task_index as number,
        terminalState: r.terminal_state as TaskRow['terminalState'],
        needSearch: (r.need_search as number) === 1,
        toolUsed: (r.tool_used as TaskRow['toolUsed']) ?? undefined,
        toolResult: (r.tool_result as TaskRow['toolResult']) ?? undefined,
        durationMs: r.duration_ms as number,
        retryCount: r.retry_count as number,
        keywordCategory: (r.keyword_category as string | null) ?? null,
      }));
    },
    async stageTracesByRun(runId) {
      const rows = stageTracesByRunStmt.all(runId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        traceId: r.trace_id as string,
        runId: r.run_id as string,
        stage: r.stage as StageTraceRow['stage'],
        durationMs: r.duration_ms as number,
        outcome: r.outcome as StageTraceRow['outcome'],
      }));
    },
    async activePolicies(scope) {
      const rows = activePoliciesStmt.all(scope) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        version: r.version as string,
        createdAt: r.created_at as number,
        scope: r.scope as string,
        conditionsJson: r.conditions_json as string,
        actionsJson: r.actions_json as string,
        rolloutPct: r.rollout_pct as number,
      }));
    },
    async writePolicy(row) {
      writePolicyStmt.run(row);
    },
    async pruneOldRecords() {
      const cutoff = Date.now() - retentionDays * 86400000;
      const tx = db.transaction(() => {
        pruneRuntimesStmt.run(cutoff);
        pruneTasksStmt.run();
        pruneStageTracesStmt.run();
      });
      tx();
    },
    close() {
      db.close();
    },
  };
}
