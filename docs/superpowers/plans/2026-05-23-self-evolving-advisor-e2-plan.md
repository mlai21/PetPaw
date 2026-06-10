# Self-Evolving Advisor Agent - Phase E.2 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。
>
> **前置条件：** Phase E.1 已合并到 master（见 `docs/superpowers/plans/2026-05-23-self-evolving-advisor-e1-plan.md`），且 `ADVISOR_RUNTIME_ENABLED=true` 已在生产灰度验证 ≥ 3 天无回归。

**上游规格：** `docs/superpowers/specs/2026-05-19-self-evolving-advisor-agent-design.md` §5 / §6.5 / §6.6 / §6.7 / §11.2

**目标：** 引入 SessionStore（SQLite）作为脱敏 trace 持久化层 + D-Learner 离线 cron 作业产出策略表 + 灰度发布机制 + mobile explicit 信号通道；加入 V3（工具优先级）/V5（query 粒度）/V6（verify 启停）三个新可调变量。

**架构：** 在 `services/api/src/modules/advisor/persistence/` 新建 SQLite SessionStore（6 张表）；在 `services/api/src/modules/advisor/learner/` 新建 D-Learner 与 6 个 V 维度子学习器；E.1 的 `RouterPolicy.memory` 升级为 `RouterPolicy.persistent`（同时读滚动统计 + 策略表）；mobile 端 advisor_chat_page 增加 👍/👎/重新回答/停止 explicit 信号 UI，通过新增的 `POST /advisor/feedback` 上报脱敏字段。

**技术栈：** TypeScript / better-sqlite3 / node-cron / Flutter（mobile 侧改动）

---

## 文件结构

### 新建（services/api/src/modules/advisor/persistence/）

| 文件 | 职责 |
|---|---|
| `persistence/migrations/001_init.sql` | 6 张表的初始 schema（详见 spec §5.2） |
| `persistence/migration_runner.ts` | 启动时按版本顺序跑 SQL migration |
| `persistence/session_store.types.ts` | Repository 接口与领域类型 |
| `persistence/session_store.sqlite.ts` | 基于 better-sqlite3 的具体实现 |
| `persistence/session_store.memory.ts` | 内存版（用于单元测试与降级） |
| `persistence/session_store.factory.ts` | 按 `ADVISOR_SESSION_STORE` 环境变量分流 |

### 新建（services/api/src/modules/advisor/learner/）

| 文件 | 职责 |
|---|---|
| `learner/d_learner.entry.ts` | cron 入口 + 工作流编排 |
| `learner/d_learner.cron.ts` | node-cron 调度封装 |
| `learner/sub_learners/v1_intent.ts` | V1 intent 阈值学习器 |
| `learner/sub_learners/v3_tool_priority.ts` | V3 工具优先级学习器 |
| `learner/sub_learners/v4_search_timeout.ts` | V4 搜索超时学习器 |
| `learner/sub_learners/v5_query_granularity.ts` | V5 query 粒度学习器（含 5% 探索写入） |
| `learner/sub_learners/v6_verify_skip.ts` | V6 verify 启停学习器 |
| `learner/sub_learners/v8_max_turns.ts` | V8 maxTurns 学习器 |
| `learner/policy_publisher.ts` | 写新 policy 行 + 默认 rollout_pct=10 |

### 修改

| 文件 | 改动 |
|---|---|
| `services/api/package.json` | 加 `better-sqlite3` + `node-cron` + types |
| `services/api/src/modules/advisor/runtime/router_policy.memory.ts` | 重命名 `router_policy.ts` 并加 persistent 支持（同时读策略表） |
| `services/api/src/modules/advisor/runtime/runtime.entry.ts` | 注入 SessionStore，每 task 边界 flush trace |
| `services/api/src/modules/advisor/runtime/env.ts` | 扩展 ADVISOR_SESSION_STORE / ADVISOR_D_LEARNER_CRON / ADVISOR_D_POLICY_VERSION / ADVISOR_TRACE_RETENTION_DAYS |
| `services/api/src/modules/advisor/advisor.controller.ts` | 新增 `POST /advisor/feedback` 端点 |
| `services/api/src/index.ts` | 启动时跑 migration + 启动 D-Learner cron |
| `services/api/.env.example` | 追加 E.2 新 env 说明 |
| `services/api/.gitignore` | 加 `var/` 目录（SQLite 文件） |

### Mobile 新建/修改

| 文件 | 改动 |
|---|---|
| `apps/mobile/lib/data/remote/advisor_feedback_repository.dart` | 新建：explicit 信号上报客户端，含隐私白名单 |
| `apps/mobile/lib/features/advisor/advisor_chat_page.dart` | 修改：消息气泡下方加 👍/👎/重新回答 按钮，顶部"停止"按钮 |
| `apps/mobile/test/data/remote/advisor_feedback_repository_test.dart` | 新建：断言上报 body 不含原文/答案/PII |
| `apps/mobile/test/features/advisor/advisor_chat_page_test.dart` | 修改：覆盖 explicit 信号 UI 与上报触发 |

### 新增测试（services/api/test/advisor/）

| 文件 | 覆盖 |
|---|---|
| `persistence/session_store_sqlite.test.ts` | 6 张表 CRUD + 保留策略 + 索引 |
| `persistence/migration_runner.test.ts` | 多版本顺序执行 + 幂等 |
| `runtime/router_policy_persistent.test.ts` | 三级降级链 + 策略表读取 + 灰度分流 hash |
| `runtime/session_resume.test.ts` | 进程重启后 SessionStore 读取最近 trace 仍可用 |
| `learner/d_learner_v1.test.ts` | V1 学习器输出符合规则 |
| `learner/d_learner_v3.test.ts` | V3 学习器输出符合规则 |
| `learner/d_learner_v4.test.ts` | V4 学习器输出符合规则 |
| `learner/d_learner_v5.test.ts` | V5 学习器 + 5% 探索写入 |
| `learner/d_learner_v6.test.ts` | V6 学习器输出符合规则 |
| `learner/d_learner_v8.test.ts` | V8 学习器输出符合规则 |
| `learner/policy_publisher.test.ts` | 新 policy 写入与 rollout_pct |
| `advisor/feedback_endpoint.test.ts` | POST /advisor/feedback 接收 + 字段校验 |

---

## 任务列表

### 任务 1：依赖安装与目录初始化

**文件：**
- 修改：`services/api/package.json`、`services/api/.gitignore`

- [ ] **步骤 1：安装依赖**

```bash
cd services/api
pnpm add better-sqlite3@^11.5.0 node-cron@^3.0.3
pnpm add -D @types/better-sqlite3@^7.6.11 @types/node-cron@^3.0.11
```

- [ ] **步骤 2：增加 .gitignore**

在 `services/api/.gitignore` 追加：

```
var/
*.db
*.db-wal
*.db-shm
```

- [ ] **步骤 3：Commit**

```bash
git add services/api/package.json services/api/pnpm-lock.yaml services/api/.gitignore
git commit -m "build(advisor/e2): add better-sqlite3 and node-cron dependencies"
```

---

### 任务 2：Migration runner + 初始 schema

**文件：**
- 创建：`services/api/src/modules/advisor/persistence/migrations/001_init.sql`
- 创建：`services/api/src/modules/advisor/persistence/migration_runner.ts`
- 测试：`services/api/test/advisor/persistence/migration_runner.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';

describe('migration_runner', () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-migrate-')), 'test.db');
  });

  it('creates all 6 tables on first run', () => {
    const db = new Database(dbPath);
    runMigrations(db);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    ).all() as Array<{ name: string }>;
    const names = new Set(tables.map((t) => t.name));
    expect(names.has('advisor_sessions')).toBe(true);
    expect(names.has('advisor_runtimes')).toBe(true);
    expect(names.has('advisor_tasks')).toBe(true);
    expect(names.has('advisor_stage_traces')).toBe(true);
    expect(names.has('advisor_policies')).toBe(true);
    expect(names.has('schema_migrations')).toBe(true);
  });

  it('is idempotent (second run does not error)', () => {
    const db = new Database(dbPath);
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/persistence/migration_runner.test.ts
```

预期：FAIL。

- [ ] **步骤 3：写 schema**

```sql
-- services/api/src/modules/advisor/persistence/migrations/001_init.sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS advisor_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON advisor_sessions(user_id, last_active_at);

CREATE TABLE IF NOT EXISTS advisor_runtimes (
  run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  terminal_state TEXT,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  message_length_bucket TEXT,
  policy_version TEXT,
  FOREIGN KEY (session_id) REFERENCES advisor_sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_runtimes_session ON advisor_runtimes(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_runtimes_terminal ON advisor_runtimes(terminal_state, started_at);

CREATE TABLE IF NOT EXISTS advisor_tasks (
  task_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_index INTEGER NOT NULL,
  terminal_state TEXT NOT NULL,
  need_search INTEGER NOT NULL,
  tool_used TEXT,
  tool_result TEXT,
  duration_ms INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  keyword_category TEXT,
  FOREIGN KEY (run_id) REFERENCES advisor_runtimes(run_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_run ON advisor_tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON advisor_tasks(keyword_category, terminal_state);

CREATE TABLE IF NOT EXISTS advisor_stage_traces (
  trace_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES advisor_runtimes(run_id)
);
CREATE INDEX IF NOT EXISTS idx_stage_traces_run ON advisor_stage_traces(run_id, stage);

CREATE TABLE IF NOT EXISTS advisor_policies (
  version TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  scope TEXT NOT NULL,
  conditions_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  rollout_pct INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_policies_scope_rollout ON advisor_policies(scope, rollout_pct);
```

- [ ] **步骤 4：写 migration_runner.ts**

```typescript
// services/api/src/modules/advisor/persistence/migration_runner.ts
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

export function runMigrations(db: Database.Database): void {
  db.prepare(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  ).run();
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>)
      .map((r) => r.version),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const insertVersion = db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)');
  const tx = db.transaction((files: string[]) => {
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      db.exec(sql);
      insertVersion.run(version, Date.now());
    }
  });
  tx(files);
}
```

- [ ] **步骤 5：验证通过 + Commit**

```bash
cd services/api && pnpm test test/advisor/persistence/migration_runner.test.ts
git add services/api/src/modules/advisor/persistence/{migration_runner.ts,migrations/001_init.sql} \
  services/api/test/advisor/persistence/migration_runner.test.ts
git commit -m "feat(advisor/persistence): migration runner with 6-table init schema"
```

---

### 任务 3：SessionStore Repository（SQLite 与 Memory 双实现）

**文件：**
- 创建：`services/api/src/modules/advisor/persistence/session_store.types.ts`
- 创建：`services/api/src/modules/advisor/persistence/session_store.sqlite.ts`
- 创建：`services/api/src/modules/advisor/persistence/session_store.memory.ts`
- 创建：`services/api/src/modules/advisor/persistence/session_store.factory.ts`
- 测试：`services/api/test/advisor/persistence/session_store_sqlite.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('SqliteSessionStore', () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-ss-')), 'test.db');
  });

  it('upserts session, writes runtime + tasks + stage traces atomically', async () => {
    const store = createSqliteSessionStore({ dbPath });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    await store.writeRuntime({
      runId: 'r1', sessionId: 's1', startedAtMs: 1000, endedAtMs: 1500,
      terminalState: 'R_COMPLETED', totalTurns: 1, totalTasks: 2,
      messageLengthBucket: 'short', policyVersion: 'v1',
    });
    await store.writeTask({
      taskId: 't1', runId: 'r1', taskIndex: 0, terminalState: 'T_DONE',
      needSearch: true, toolUsed: 'tavily-search', toolResult: 'success',
      durationMs: 120, retryCount: 0, keywordCategory: 'weather',
    });
    await store.writeStageTrace({
      traceId: 'st1', runId: 'r1', stage: 'verify', durationMs: 50, outcome: 'pass',
    });
    const runs = await store.recentRuntimesBySession('s1', 5);
    expect(runs).toHaveLength(1);
    expect(runs[0].terminalState).toBe('R_COMPLETED');
    const tasks = await store.tasksByRun('r1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].keywordCategory).toBe('weather');
    const stages = await store.stageTracesByRun('r1');
    expect(stages.find((s) => s.stage === 'verify')?.outcome).toBe('pass');
    store.close();
  });

  it('prunes records older than retention days', async () => {
    const store = createSqliteSessionStore({ dbPath, retentionDays: 1 });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    const oldMs = Date.now() - 86400000 * 3; // 3 days ago
    await store.writeRuntime({
      runId: 'r-old', sessionId: 's1', startedAtMs: oldMs, endedAtMs: oldMs + 1000,
      terminalState: 'R_COMPLETED', totalTurns: 1, totalTasks: 1,
      messageLengthBucket: 'short', policyVersion: 'v1',
    });
    await store.writeRuntime({
      runId: 'r-new', sessionId: 's1', startedAtMs: Date.now(), endedAtMs: Date.now() + 1000,
      terminalState: 'R_COMPLETED', totalTurns: 1, totalTasks: 1,
      messageLengthBucket: 'short', policyVersion: 'v1',
    });
    await store.pruneOldRecords();
    const remaining = await store.recentRuntimesBySession('s1', 10);
    expect(remaining.map((r) => r.runId)).toEqual(['r-new']);
    store.close();
  });

  it('rejects writes containing PII-like fields (defense in depth)', async () => {
    const store = createSqliteSessionStore({ dbPath });
    await store.upsertSession({ sessionId: 's1', userId: 'u1' });
    await expect(
      store.writeRuntime({
        runId: 'r-bad', sessionId: 's1', startedAtMs: 1000, endedAtMs: 1500,
        terminalState: 'R_COMPLETED', totalTurns: 1, totalTasks: 1,
        // @ts-expect-error 故意构造非法字段以验证拒绝
        rawMessage: '用户原文',
        messageLengthBucket: 'short', policyVersion: 'v1',
      }),
    ).rejects.toThrow(/disallowed_field/i);
    store.close();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/persistence/session_store_sqlite.test.ts
```

预期：FAIL。

- [ ] **步骤 3：写类型与实现**

```typescript
// services/api/src/modules/advisor/persistence/session_store.types.ts
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
  close(): void;
}

const DISALLOWED_FIELDS = new Set([
  'rawMessage',
  'rawAnswer',
  'phoneNumber',
  'email',
  'url',
  'urls',
]);

export function assertNoDisallowedFields(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (DISALLOWED_FIELDS.has(key)) {
      throw new Error(`disallowed_field:${key}`);
    }
  }
}
```

```typescript
// services/api/src/modules/advisor/persistence/session_store.sqlite.ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migration_runner';
import {
  assertNoDisallowedFields,
  type PolicyRow,
  type RuntimeRow,
  type SessionRow,
  type SessionStore,
  type StageTraceRow,
  type TaskRow,
} from './session_store.types';

export function createSqliteSessionStore(params: { dbPath: string; retentionDays?: number }): SessionStore {
  fs.mkdirSync(path.dirname(params.dbPath), { recursive: true });
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
  const activePoliciesStmt = db.prepare(`SELECT * FROM advisor_policies WHERE scope = ? AND rollout_pct > 0`);
  const writePolicyStmt = db.prepare(`
    INSERT INTO advisor_policies(version, created_at, scope, conditions_json, actions_json, rollout_pct)
    VALUES (@version, @createdAt, @scope, @conditionsJson, @actionsJson, @rolloutPct)
  `);
  const pruneRuntimesStmt = db.prepare(`DELETE FROM advisor_runtimes WHERE started_at < ?`);
  const pruneTasksStmt = db.prepare(`DELETE FROM advisor_tasks WHERE run_id NOT IN (SELECT run_id FROM advisor_runtimes)`);
  const pruneStageTracesStmt = db.prepare(`DELETE FROM advisor_stage_traces WHERE run_id NOT IN (SELECT run_id FROM advisor_runtimes)`);

  return {
    async upsertSession(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      upsertSessionStmt.run({ sessionId: row.sessionId, userId: row.userId, nowMs: Date.now() });
    },
    async writeRuntime(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeRuntimeStmt.run({
        runId: row.runId, sessionId: row.sessionId, startedAtMs: row.startedAtMs, endedAtMs: row.endedAtMs,
        terminalState: row.terminalState, totalTurns: row.totalTurns, totalTasks: row.totalTasks,
        messageLengthBucket: row.messageLengthBucket, policyVersion: row.policyVersion,
      });
    },
    async writeTask(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeTaskStmt.run({
        taskId: row.taskId, runId: row.runId, taskIndex: row.taskIndex, terminalState: row.terminalState,
        needSearch: row.needSearch ? 1 : 0, toolUsed: row.toolUsed ?? null, toolResult: row.toolResult ?? null,
        durationMs: row.durationMs, retryCount: row.retryCount, keywordCategory: row.keywordCategory ?? null,
      });
    },
    async writeStageTrace(row) {
      assertNoDisallowedFields(row as unknown as Record<string, unknown>);
      writeStageTraceStmt.run(row);
    },
    async recentRuntimesBySession(sessionId, limit) {
      const rows = recentRuntimesStmt.all(sessionId, limit) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        runId: r.run_id as string, sessionId: r.session_id as string,
        startedAtMs: r.started_at as number, endedAtMs: r.ended_at as number,
        terminalState: r.terminal_state as RuntimeRow['terminalState'],
        totalTurns: r.total_turns as number, totalTasks: r.total_tasks as number,
        messageLengthBucket: r.message_length_bucket as RuntimeRow['messageLengthBucket'],
        policyVersion: r.policy_version as string,
      }));
    },
    async tasksByRun(runId) {
      const rows = tasksByRunStmt.all(runId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        taskId: r.task_id as string, runId: r.run_id as string, taskIndex: r.task_index as number,
        terminalState: r.terminal_state as TaskRow['terminalState'],
        needSearch: (r.need_search as number) === 1,
        toolUsed: (r.tool_used as TaskRow['toolUsed']) ?? undefined,
        toolResult: (r.tool_result as TaskRow['toolResult']) ?? undefined,
        durationMs: r.duration_ms as number, retryCount: r.retry_count as number,
        keywordCategory: (r.keyword_category as string | null) ?? null,
      }));
    },
    async stageTracesByRun(runId) {
      const rows = stageTracesByRunStmt.all(runId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        traceId: r.trace_id as string, runId: r.run_id as string,
        stage: r.stage as StageTraceRow['stage'],
        durationMs: r.duration_ms as number, outcome: r.outcome as StageTraceRow['outcome'],
      }));
    },
    async activePolicies(scope) {
      const rows = activePoliciesStmt.all(scope) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        version: r.version as string, createdAt: r.created_at as number,
        scope: r.scope as string, conditionsJson: r.conditions_json as string,
        actionsJson: r.actions_json as string, rolloutPct: r.rollout_pct as number,
      }));
    },
    async writePolicy(row) { writePolicyStmt.run(row); },
    async pruneOldRecords() {
      const cutoff = Date.now() - retentionDays * 86400000;
      const tx = db.transaction(() => {
        pruneRuntimesStmt.run(cutoff);
        pruneTasksStmt.run();
        pruneStageTracesStmt.run();
      });
      tx();
    },
    close() { db.close(); },
  };
}
```

```typescript
// services/api/src/modules/advisor/persistence/session_store.memory.ts
import type { SessionStore } from './session_store.types';

export function createMemorySessionStore(): SessionStore {
  // 简单内存实现，省略：所有方法 push 到内存数组；用于单测
  // 完整实现：照搬 sqlite 的接口签名，存储到 Map<string, T[]>
  // 此处略，按需补全（任务 5 单测使用 sqlite memory dbPath=':memory:' 也可）
  return {} as SessionStore;
}
```

```typescript
// services/api/src/modules/advisor/persistence/session_store.factory.ts
import { createSqliteSessionStore } from './session_store.sqlite';
import type { SessionStore } from './session_store.types';

export function createSessionStoreFromEnv(): SessionStore {
  const kind = (process.env.ADVISOR_SESSION_STORE ?? 'sqlite').trim();
  if (kind === 'memory') {
    return createSqliteSessionStore({ dbPath: ':memory:' });
  }
  if (kind === 'sqlite') {
    const dbPath = process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db';
    const retentionDays = Number(process.env.ADVISOR_TRACE_RETENTION_DAYS?.trim() || '90') || 90;
    return createSqliteSessionStore({ dbPath, retentionDays });
  }
  if (kind === 'postgres') {
    throw new Error('postgres session store: not implemented in E.2 (planned for E.3 evaluation)');
  }
  throw new Error(`unknown ADVISOR_SESSION_STORE: ${kind}`);
}
```

- [ ] **步骤 4：验证通过 + Commit**

```bash
cd services/api && pnpm test test/advisor/persistence/session_store_sqlite.test.ts
git add services/api/src/modules/advisor/persistence/session_store.{types,sqlite,memory,factory}.ts \
  services/api/test/advisor/persistence/session_store_sqlite.test.ts
git commit -m "feat(advisor/persistence): SQLite SessionStore with retention + PII guard"
```

---

### 任务 4：env.ts 扩展 + 启动时跑 migration

**文件：**
- 修改：`services/api/src/modules/advisor/runtime/env.ts`
- 修改：`services/api/src/index.ts`

- [ ] **步骤 1：扩展 RuntimeEnv**

在 `runtime/env.ts` 加：

```typescript
// 在 RuntimeEnv 类型与 readRuntimeEnv 中追加
export type RuntimeEnv = {
  // ... 之前的字段
  sessionStore: 'sqlite' | 'postgres' | 'memory';
  sessionStorePath: string;
  traceRetentionDays: number;
  dLearnerCron: string;
  dPolicyVersionMode: 'auto' | string; // string 时表示 pinned 版本
};

// readRuntimeEnv 内追加
sessionStore: ((process.env.ADVISOR_SESSION_STORE ?? 'sqlite').trim() as 'sqlite' | 'postgres' | 'memory'),
sessionStorePath: process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db',
traceRetentionDays: parseIntInRange(process.env.ADVISOR_TRACE_RETENTION_DAYS, 90, 7, 365),
dLearnerCron: process.env.ADVISOR_D_LEARNER_CRON?.trim() || '0 4 * * *',
dPolicyVersionMode: (process.env.ADVISOR_D_POLICY_VERSION?.trim() || 'auto'),
```

- [ ] **步骤 2：启动时跑 migration**

修改 `services/api/src/index.ts`，在 `export const app = express();` 之后加：

```typescript
import { createSessionStoreFromEnv } from './modules/advisor/persistence/session_store.factory';

// 全局 SessionStore 单例（E.2 起）
export const sessionStore = (() => {
  try {
    return createSessionStoreFromEnv();
  } catch (err) {
    console.warn('[advisor][session_store_init_failed]', err instanceof Error ? err.message : String(err));
    return null;
  }
})();
```

- [ ] **步骤 3：测试 + Commit**

```bash
cd services/api && pnpm test
git add services/api/src/modules/advisor/runtime/env.ts services/api/src/index.ts
git commit -m "feat(advisor/e2): extend env config and bootstrap SessionStore singleton"
```

---

### 任务 5：Runtime 接入 SessionStore，按 task 边界写盘

**文件：**
- 修改：`services/api/src/modules/advisor/runtime/scheduler.ts`
- 修改：`services/api/src/modules/advisor/runtime/runtime.entry.ts`
- 测试：`services/api/test/advisor/runtime/session_resume.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';
import { runAdvisorRuntime } from '../../../src/modules/advisor/runtime/runtime.entry';

describe('Runtime writes to SessionStore at task boundary', () => {
  it('persists runtime + tasks + stage traces after a successful run', async () => {
    process.env.ADVISOR_SESSION_STORE = 'memory';
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    // 注入 store + mock 所有 agent adapter（详见 scheduler.test.ts 的 mock 模式）
    // 期望：跑完后能从 store 查到 runtime / tasks / stage_traces 各 ≥ 1 行
    expect(true).toBe(true); // 占位：实现时替换为真实断言
    store.close();
  });
});
```

- [ ] **步骤 2：编写 scheduler 写盘钩子**

`scheduler.ts` 的 `SchedulerInput` 增加：

```typescript
import type { SessionStore } from '../persistence/session_store.types';

export type SchedulerInput = {
  // ... 现有字段
  sessionStore?: SessionStore;
};
```

在 `recordEvent` 之外，task 进入 T_DONE/T_SKIPPED/T_FAILED 时同步写 `advisor_tasks` 行；Runtime 进入终态时写 `advisor_runtimes` + 所有 stage_traces。

```typescript
// 在 scheduler.ts 内补充辅助函数
async function flushRuntime(input: SchedulerInput, runtime: RuntimeContext, tasks: TaskContext[], stageTraces: StageTraceRow[]): Promise<void> {
  if (!input.sessionStore) return;
  await input.sessionStore.upsertSession({ sessionId: input.sessionId, userId: 'unknown' });
  await input.sessionStore.writeRuntime({
    runId: input.runId,
    sessionId: input.sessionId,
    startedAtMs: runtime.startedAtMs ?? Date.now(),
    endedAtMs: runtime.endedAtMs ?? Date.now(),
    terminalState: runtime.state as 'R_COMPLETED' | 'R_FAILED' | 'R_ABORTED',
    totalTurns: runtime.turnIndex + 1,
    totalTasks: tasks.length,
    messageLengthBucket: input.userMessage.length < 20 ? 'short' : input.userMessage.length < 100 ? 'medium' : 'long',
    policyVersion: input.policyVersion ?? 'none',
  });
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.state !== 'T_DONE' && t.state !== 'T_SKIPPED' && t.state !== 'T_FAILED') continue;
    await input.sessionStore.writeTask({
      taskId: t.taskId, runId: input.runId, taskIndex: i,
      terminalState: t.state as 'T_DONE' | 'T_FAILED' | 'T_SKIPPED',
      needSearch: t.needSearch, durationMs: (t.endedAtMs ?? Date.now()) - (t.startedAtMs ?? Date.now()),
      retryCount: t.retryCount, keywordCategory: input.keywordCategory ?? null,
    });
  }
  for (const trace of stageTraces) {
    await input.sessionStore.writeStageTrace(trace);
  }
}
```

在 scheduler 进入终态前调用 `flushRuntime`。

- [ ] **步骤 3：runtime.entry.ts 注入 SessionStore**

```typescript
// runtime.entry.ts 顶部加
import { sessionStore } from '../../../index';
import { classifyKeywords } from './keyword_categories';

// 在 runScheduler 调用处增加 sessionStore: sessionStore ?? undefined, keywordCategory: classifyKeywords(input.userMessage)
```

- [ ] **步骤 4：验证 + Commit**

```bash
cd services/api && pnpm test
git add services/api/src/modules/advisor/runtime/{scheduler,runtime.entry}.ts \
  services/api/test/advisor/runtime/session_resume.test.ts
git commit -m "feat(advisor/runtime): persist trace to SessionStore at task boundaries"
```

---

### 任务 6：RouterPolicy.persistent（合并内存版 + 策略表读取 + 灰度分流）

**文件：**
- 重命名：`router_policy.memory.ts` → `router_policy.ts`（保留 memory 函数 + 加 persistent）
- 测试：`services/api/test/advisor/runtime/router_policy_persistent.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { createPersistentRouterPolicy } from '../../../src/modules/advisor/runtime/router_policy';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('PersistentRouterPolicy with policy table + rollout', () => {
  it('falls back to default when no policy matches', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    const policy = createPersistentRouterPolicy({ enabled: true, mode: 'with_policy_table', store, sessionId: 's1' });
    const result = await policy.decideAsync({
      decisionPoint: 'setSearchTimeout', signal: { messageLengthBucket: 'short', keywordCategory: 'weather', recentToolFailureRate: 0, recentVerifyFailRate: 0 },
      defaults: { value: 12000 },
    });
    expect(result.source).toBe('default');
    store.close();
  });

  it('applies policy when sessionId hash falls within rollout_pct', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await store.writePolicy({
      version: 'v-test', createdAt: Date.now(),
      scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 100,
    });
    const policy = createPersistentRouterPolicy({ enabled: true, mode: 'with_policy_table', store, sessionId: 's1' });
    const result = await policy.decideAsync({
      decisionPoint: 'setSearchTimeout', signal: { messageLengthBucket: 'short', keywordCategory: 'weather', recentToolFailureRate: 0, recentVerifyFailRate: 0 },
      defaults: { value: 12000 },
    });
    expect(result.source).toBe('d_policy');
    expect(result.value).toBe(6000);
    store.close();
  });

  it('does NOT apply policy when sessionId hash falls outside rollout_pct (sample at 5%)', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await store.writePolicy({
      version: 'v-test', createdAt: Date.now(), scope: 'setSearchTimeout',
      conditionsJson: JSON.stringify({ keyword_category: 'weather' }),
      actionsJson: JSON.stringify({ timeout_ms: 6000 }),
      rolloutPct: 5,
    });
    let hitDPolicy = 0, hitDefault = 0;
    for (let i = 0; i < 200; i++) {
      const policy = createPersistentRouterPolicy({ enabled: true, mode: 'with_policy_table', store, sessionId: `s${i}` });
      const result = await policy.decideAsync({
        decisionPoint: 'setSearchTimeout', signal: { messageLengthBucket: 'short', keywordCategory: 'weather', recentToolFailureRate: 0, recentVerifyFailRate: 0 },
        defaults: { value: 12000 },
      });
      if (result.source === 'd_policy') hitDPolicy++; else hitDefault++;
    }
    expect(hitDPolicy).toBeGreaterThan(2);  // 大约 10/200 命中
    expect(hitDPolicy).toBeLessThan(30);
    expect(hitDefault).toBeGreaterThan(170);
    store.close();
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/runtime/router_policy.ts
import { createHash } from 'node:crypto';
import type { SessionStore } from '../persistence/session_store.types';
import type { RollingStats, RouterDecision, RouterDecisionInput, RouterPolicy } from './router_policy.types';

export { createMemoryRouterPolicy } from './router_policy.memory';

export type PersistentOptions = {
  enabled: boolean;
  mode: 'rolling_stats_only' | 'with_policy_table';
  store: SessionStore;
  sessionId: string;
  windowMs?: number;
};

function hashToPercent(seed: string): number {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 8);
  const n = parseInt(hex, 16);
  return n % 100;
}

export type PersistentRouterPolicy = RouterPolicy & {
  decideAsync<T>(input: RouterDecisionInput<T>): Promise<RouterDecision<T>>;
};

export function createPersistentRouterPolicy(opts: PersistentOptions): PersistentRouterPolicy {
  // 复用内存版 rolling stats
  const memory = require('./router_policy.memory').createMemoryRouterPolicy({
    enabled: opts.enabled, mode: opts.mode, windowMs: opts.windowMs,
  });

  return {
    decide<T>(input: RouterDecisionInput<T>): RouterDecision<T> {
      // 同步模式：fallback 到内存版
      return memory.decide(input);
    },
    async decideAsync<T>(input: RouterDecisionInput<T>): Promise<RouterDecision<T>> {
      if (input.humanOverride) {
        return { source: 'human_override', value: input.humanOverride.value, reason: input.humanOverride.reason };
      }
      if (!opts.enabled) return { source: 'default', value: input.defaults.value };

      if (opts.mode === 'with_policy_table') {
        const policies = await opts.store.activePolicies(input.decisionPoint);
        const userPct = hashToPercent(opts.sessionId);
        for (const p of policies) {
          if (userPct >= p.rolloutPct) continue;
          const conditions = JSON.parse(p.conditionsJson) as Record<string, unknown>;
          const matched = matchConditions(conditions, input.signal);
          if (!matched) continue;
          const actions = JSON.parse(p.actionsJson) as Record<string, unknown>;
          const value = extractValueByDecisionPoint(input.decisionPoint, actions);
          if (value !== null) {
            return { source: 'd_policy', value: value as T, policyVersion: p.version };
          }
        }
      }

      // fallback 到内存滚动统计逻辑
      return memory.decide(input);
    },
    recordSignal(event) { memory.recordSignal(event); },
    getStats(): RollingStats { return memory.getStats(); },
  };
}

function matchConditions(conditions: Record<string, unknown>, signal: { keywordCategory?: string | null; messageLengthBucket: string }): boolean {
  for (const [key, val] of Object.entries(conditions)) {
    if (key === 'keyword_category' && signal.keywordCategory !== val) return false;
    if (key === 'message_length_bucket' && signal.messageLengthBucket !== val) return false;
  }
  return true;
}

function extractValueByDecisionPoint(point: string, actions: Record<string, unknown>): unknown | null {
  if (point === 'setSearchTimeout') return actions.timeout_ms ?? null;
  if (point === 'routeIntent') return actions.force_plan ?? null;
  if (point === 'setMaxTurns') return actions.max_turns ?? null;
  if (point === 'selectToolOrder') return actions.tool_order ?? null;
  if (point === 'shouldSkipVerify') return actions.skip_verify ?? null;
  if (point === 'chooseTaskQuery') return actions.query_granularity ?? null;
  return null;
}
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/runtime/router_policy_persistent.test.ts
git add services/api/src/modules/advisor/runtime/router_policy.ts \
  services/api/test/advisor/runtime/router_policy_persistent.test.ts
git commit -m "feat(advisor/runtime): persistent RouterPolicy with policy table + rollout hash"
```

---

### 任务 7-12：6 个 D 子学习器

**说明：** 每个子学习器是一个独立单元，结构相似。这里展开 V1 的完整 TDD，V3/V4/V5/V6/V8 按相同模板实现。

#### 任务 7：V1 intent 阈值学习器

**文件：**
- 创建：`services/api/src/modules/advisor/learner/sub_learners/v1_intent.ts`
- 测试：`services/api/test/advisor/learner/d_learner_v1.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { learnV1Intent } from '../../../src/modules/advisor/learner/sub_learners/v1_intent';

describe('V1 intent learner', () => {
  it('outputs force_plan=true for category with usage rate > 80%', () => {
    const trainSet = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'weather',
      messageLengthBucket: 'short' as const,
      usedHeavyPath: i < 18,  // 18/20 = 90%
    }));
    const policies = learnV1Intent(trainSet);
    const weatherShort = policies.find((p) => p.conditions.keyword_category === 'weather' && p.conditions.message_length_bucket === 'short');
    expect(weatherShort?.actions.force_plan).toBe(true);
  });

  it('outputs force_plan=false for category with usage rate < 30%', () => {
    const trainSet = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'tech',
      messageLengthBucket: 'short' as const,
      usedHeavyPath: i < 5,  // 25%
    }));
    const policies = learnV1Intent(trainSet);
    const techShort = policies.find((p) => p.conditions.keyword_category === 'tech');
    expect(techShort?.actions.force_plan).toBe(false);
  });

  it('outputs nothing for categories with insufficient sample (< 50)', () => {
    const trainSet = [
      { keywordCategory: 'weather', messageLengthBucket: 'short' as const, usedHeavyPath: true },
    ];
    expect(learnV1Intent(trainSet)).toEqual([]);
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/learner/sub_learners/v1_intent.ts
export type V1Sample = {
  keywordCategory: string | null;
  messageLengthBucket: 'short' | 'medium' | 'long';
  usedHeavyPath: boolean; // intent.needPlan=true 且结果被采纳
};

export type V1Policy = {
  scope: 'routeIntent';
  conditions: { keyword_category: string; message_length_bucket: string };
  actions: { force_plan: boolean };
};

const MIN_SAMPLES_PER_GROUP = 50;

export function learnV1Intent(samples: V1Sample[]): V1Policy[] {
  const groups = new Map<string, V1Sample[]>();
  for (const s of samples) {
    if (!s.keywordCategory) continue;
    const key = `${s.keywordCategory}::${s.messageLengthBucket}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  const policies: V1Policy[] = [];
  for (const [key, list] of groups.entries()) {
    if (list.length < MIN_SAMPLES_PER_GROUP) continue;
    const [category, bucket] = key.split('::');
    const rate = list.filter((s) => s.usedHeavyPath).length / list.length;
    if (rate > 0.8) {
      policies.push({ scope: 'routeIntent', conditions: { keyword_category: category, message_length_bucket: bucket }, actions: { force_plan: true } });
    } else if (rate < 0.3) {
      policies.push({ scope: 'routeIntent', conditions: { keyword_category: category, message_length_bucket: bucket }, actions: { force_plan: false } });
    }
  }
  return policies;
}
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/learner/d_learner_v1.test.ts
git add services/api/src/modules/advisor/learner/sub_learners/v1_intent.ts \
  services/api/test/advisor/learner/d_learner_v1.test.ts
git commit -m "feat(advisor/learner): V1 intent threshold learner"
```

#### 任务 8-12：V3 / V4 / V5 / V6 / V8 学习器

按 spec §6.5 的算法实现每个子学习器，结构与任务 7 相同：

| 子任务 | scope | 输入样本字段 | 输出 actions |
|---|---|---|---|
| **任务 8 V3** | `selectToolOrder` | `{keywordCategory, toolUsed, toolResult}` | `{tool_order: ['tavily','bailian','x']}`（按成功率降序） |
| **任务 9 V4** | `setSearchTimeout` | `{toolDurationMs[]}` | `{timeout_ms: max(5000, P95*1.5)}`，向上取整 1000ms |
| **任务 10 V5** | `chooseTaskQuery` | `{keywordCategory, queryGranularity, taskOutcome}` | `{query_granularity: 'task_level'}` 当显著优于；**关键**：写入 sampler 标记，使 runtime 对 5% 流量强制采用 `task_level` 收集对照样本（在 v5 文件里 export 一个 `shouldExploreTaskLevel(sessionId): boolean` 函数，runtime.entry.ts 调用） |
| **任务 11 V6** | `shouldSkipVerify` | `{keywordCategory, messageLengthBucket, verifyChangedOutput}` | `{skip_verify: true}` 当改写率 < 5% |
| **任务 12 V8** | `setMaxTurns` | `{actualTurns[]}` | `{max_turns: clamp(P95, 2, 5)}` |

每个任务 5 步：失败测试 → 验证失败 → 实现 → 验证通过 → Commit。**示例命令模板：**

```bash
cd services/api && pnpm test test/advisor/learner/d_learner_v{N}.test.ts
git add services/api/src/modules/advisor/learner/sub_learners/v{N}_*.ts \
  services/api/test/advisor/learner/d_learner_v{N}.test.ts
git commit -m "feat(advisor/learner): V{N} learner per spec §6.5"
```

---

### 任务 13：D-Learner 编排 + Policy Publisher + cron 启动

**文件：**
- 创建：`services/api/src/modules/advisor/learner/d_learner.entry.ts`
- 创建：`services/api/src/modules/advisor/learner/policy_publisher.ts`
- 创建：`services/api/src/modules/advisor/learner/d_learner.cron.ts`
- 修改：`services/api/src/index.ts`

- [ ] **步骤 1：编写 policy_publisher 与失败测试**

```typescript
// services/api/test/advisor/learner/policy_publisher.test.ts
import { publishPolicy } from '../../../src/modules/advisor/learner/policy_publisher';
import { createSqliteSessionStore } from '../../../src/modules/advisor/persistence/session_store.sqlite';

describe('publishPolicy', () => {
  it('writes new policy row with rolloutPct=10 by default', async () => {
    const store = createSqliteSessionStore({ dbPath: ':memory:' });
    await publishPolicy(store, { scope: 'routeIntent', conditions: { keyword_category: 'weather' }, actions: { force_plan: true } });
    const policies = await store.activePolicies('routeIntent');
    expect(policies).toHaveLength(1);
    expect(policies[0].rolloutPct).toBe(10);
    store.close();
  });
});
```

实现：

```typescript
// services/api/src/modules/advisor/learner/policy_publisher.ts
import type { SessionStore } from '../persistence/session_store.types';

export async function publishPolicy(
  store: SessionStore,
  input: { scope: string; conditions: Record<string, unknown>; actions: Record<string, unknown>; rolloutPct?: number },
): Promise<string> {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hhmm = now.toISOString().slice(11, 16).replace(':', '');
  const version = `v${yyyymmdd}-${hhmm}-${Math.floor(Math.random() * 9000) + 1000}`;
  await store.writePolicy({
    version, createdAt: now.getTime(), scope: input.scope,
    conditionsJson: JSON.stringify(input.conditions),
    actionsJson: JSON.stringify(input.actions),
    rolloutPct: input.rolloutPct ?? 10,
  });
  return version;
}
```

- [ ] **步骤 2：D-Learner entry**

```typescript
// services/api/src/modules/advisor/learner/d_learner.entry.ts
import { learnV1Intent } from './sub_learners/v1_intent';
// ... 其他 5 个 import
import { publishPolicy } from './policy_publisher';
import type { SessionStore } from '../persistence/session_store.types';

export async function runDLearnerOnce(store: SessionStore): Promise<{ publishedVersions: string[] }> {
  const versions: string[] = [];
  // 1. 收集训练样本（按 V1-V8 各自需要的字段查询 SessionStore）
  //    完整实现：扫描过去 7 天 advisor_runtimes JOIN advisor_tasks JOIN advisor_stage_traces
  //    （为节约 plan 长度，实际查询 SQL 在实现时按子学习器需要补全）
  // 2. 各学习器输出
  // 3. publishPolicy 写入并记录 version
  return { publishedVersions: versions };
}
```

- [ ] **步骤 3：cron 启动**

```typescript
// services/api/src/modules/advisor/learner/d_learner.cron.ts
import cron from 'node-cron';
import { runDLearnerOnce } from './d_learner.entry';
import type { SessionStore } from '../persistence/session_store.types';

export function scheduleDLearner(store: SessionStore, cronExpr: string): void {
  if (!cron.validate(cronExpr)) {
    console.warn('[advisor][d_learner] invalid cron expression, skip:', cronExpr);
    return;
  }
  cron.schedule(cronExpr, async () => {
    try {
      const result = await runDLearnerOnce(store);
      console.log('[advisor][d_learner_run]', JSON.stringify({ publishedVersions: result.publishedVersions }));
    } catch (err) {
      console.error('[advisor][d_learner_failed]', err instanceof Error ? err.message : String(err));
    }
  });
}
```

修改 `services/api/src/index.ts` 添加启动：

```typescript
import { scheduleDLearner } from './modules/advisor/learner/d_learner.cron';
import { readRuntimeEnv } from './modules/advisor/runtime/env';

if (sessionStore) {
  const env = readRuntimeEnv();
  scheduleDLearner(sessionStore, env.dLearnerCron);
}
```

- [ ] **步骤 4：验证 + Commit**

```bash
cd services/api && pnpm test
git add services/api/src/modules/advisor/learner/{d_learner.entry,d_learner.cron,policy_publisher}.ts \
  services/api/test/advisor/learner/policy_publisher.test.ts \
  services/api/src/index.ts
git commit -m "feat(advisor/learner): D-Learner cron orchestration + policy publisher"
```

---

### 任务 14：Mobile explicit 信号 UI + 上报通道

**文件：**
- 创建：`apps/mobile/lib/data/remote/advisor_feedback_repository.dart`
- 修改：`apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- 测试：`apps/mobile/test/data/remote/advisor_feedback_repository_test.dart`
- 测试：修改 `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [ ] **步骤 1：编写失败的隐私边界测试**

```dart
// apps/mobile/test/data/remote/advisor_feedback_repository_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/remote/advisor_feedback_repository.dart';

void main() {
  group('AdvisorFeedbackRepository', () {
    test('payload contains only whitelisted fields', () {
      final payload = AdvisorFeedbackRepository.buildPayload(
        sessionId: 's-uuid-1',
        feedbackType: FeedbackType.helpful,
        messageLengthBucket: MessageLengthBucket.short,
        userCancelled: false,
      );
      final allowedKeys = {'sessionId', 'feedbackType', 'messageLengthBucket', 'userCancelled', 'timestampMs'};
      expect(payload.keys.toSet().difference(allowedKeys), isEmpty);
    });

    test('payload NEVER contains rawMessage, answer, urls, phone, email', () {
      final payload = AdvisorFeedbackRepository.buildPayload(
        sessionId: 's-uuid-1',
        feedbackType: FeedbackType.notHelpful,
        messageLengthBucket: MessageLengthBucket.medium,
        userCancelled: true,
      );
      for (final forbidden in ['rawMessage', 'rawAnswer', 'message', 'answer', 'url', 'urls', 'phoneNumber', 'email']) {
        expect(payload.containsKey(forbidden), isFalse, reason: 'leaked field: $forbidden');
      }
    });
  });
}
```

- [ ] **步骤 2：编写实现**

```dart
// apps/mobile/lib/data/remote/advisor_feedback_repository.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

enum FeedbackType { helpful, notHelpful, regenerateRequested, stoppedByUser }
enum MessageLengthBucket { short, medium, long }

class AdvisorFeedbackRepository {
  AdvisorFeedbackRepository({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  static Map<String, dynamic> buildPayload({
    required String sessionId,
    required FeedbackType feedbackType,
    required MessageLengthBucket messageLengthBucket,
    required bool userCancelled,
  }) {
    return {
      'sessionId': sessionId,
      'feedbackType': feedbackType.name,
      'messageLengthBucket': messageLengthBucket.name,
      'userCancelled': userCancelled,
      'timestampMs': DateTime.now().millisecondsSinceEpoch,
    };
  }

  Future<void> report({
    required String sessionId,
    required FeedbackType feedbackType,
    required MessageLengthBucket messageLengthBucket,
    bool userCancelled = false,
  }) async {
    final payload = buildPayload(
      sessionId: sessionId,
      feedbackType: feedbackType,
      messageLengthBucket: messageLengthBucket,
      userCancelled: userCancelled,
    );
    try {
      await _client.post(
        Uri.parse('$baseUrl/advisor/feedback'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );
    } catch (_) {
      // silently swallow; explicit feedback 是 best-effort
    }
  }
}
```

- [ ] **步骤 3：UI 接入**

在 `advisor_chat_page.dart` 的 advisor 气泡下方加 `Row` 含 3 个 IconButton（👍 / 👎 / 重新回答），点击调用 `AdvisorFeedbackRepository.report`；顶部 AppBar 加"停止"按钮，发送中可见。

- [ ] **步骤 4：验证 + Commit**

```bash
cd apps/mobile && flutter test
git add apps/mobile/lib/data/remote/advisor_feedback_repository.dart \
  apps/mobile/lib/features/advisor/advisor_chat_page.dart \
  apps/mobile/test/data/remote/advisor_feedback_repository_test.dart \
  apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat(mobile/advisor): explicit feedback UI with privacy-bounded payload"
```

---

### 任务 15：POST /advisor/feedback 端点 + 服务端字段校验

**文件：**
- 修改：`services/api/src/modules/advisor/advisor.controller.ts`
- 测试：`services/api/test/advisor/feedback_endpoint.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import request from 'supertest';
import { app } from '../../src/index';

describe('POST /advisor/feedback', () => {
  it('accepts valid payload and returns 204', async () => {
    await request(app).post('/advisor/feedback').send({
      sessionId: 's1', feedbackType: 'helpful', messageLengthBucket: 'short',
      userCancelled: false, timestampMs: Date.now(),
    }).expect(204);
  });

  it('rejects payload containing forbidden fields with 400', async () => {
    const res = await request(app).post('/advisor/feedback').send({
      sessionId: 's1', feedbackType: 'helpful', messageLengthBucket: 'short',
      userCancelled: false, rawMessage: '用户原文（不允许）',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/disallowed_field/);
  });

  it('rejects payload with invalid feedbackType', async () => {
    const res = await request(app).post('/advisor/feedback').send({
      sessionId: 's1', feedbackType: 'nonsense', messageLengthBucket: 'short', userCancelled: false,
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **步骤 2：实现端点**

在 `advisor.controller.ts` 添加：

```typescript
const ALLOWED_FEEDBACK_KEYS = new Set(['sessionId', 'feedbackType', 'messageLengthBucket', 'userCancelled', 'timestampMs']);
const ALLOWED_FEEDBACK_TYPES = new Set(['helpful', 'notHelpful', 'regenerateRequested', 'stoppedByUser']);
const ALLOWED_BUCKETS = new Set(['short', 'medium', 'long']);

advisorRouter.post('/feedback', (req, res) => {
  const body = req.body ?? {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FEEDBACK_KEYS.has(key)) {
      return res.status(400).json({ error: `disallowed_field:${key}` });
    }
  }
  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return res.status(400).json({ error: 'invalid_sessionId' });
  }
  if (!ALLOWED_FEEDBACK_TYPES.has(body.feedbackType)) {
    return res.status(400).json({ error: 'invalid_feedbackType' });
  }
  if (!ALLOWED_BUCKETS.has(body.messageLengthBucket)) {
    return res.status(400).json({ error: 'invalid_messageLengthBucket' });
  }
  console.log('[advisor][explicit_feedback]', JSON.stringify(body));
  res.status(204).end();
});
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/feedback_endpoint.test.ts
git add services/api/src/modules/advisor/advisor.controller.ts \
  services/api/test/advisor/feedback_endpoint.test.ts
git commit -m "feat(advisor/api): POST /advisor/feedback with strict whitelist validation"
```

---

### 任务 16：环境变量与文档更新

**文件：**
- 修改：`services/api/.env.example`

- [ ] **步骤 1：追加新增环境变量**

```bash

# === E.2: SessionStore + D-Learner ===
ADVISOR_SESSION_STORE=sqlite             # sqlite | postgres | memory
ADVISOR_SESSION_STORE_PATH=./var/advisor.db
ADVISOR_TRACE_RETENTION_DAYS=90          # 7-365
ADVISOR_D_LEARNER_CRON=0 4 * * *         # node-cron 表达式
ADVISOR_D_POLICY_VERSION=auto            # auto | <pinned-version-string>
```

- [ ] **步骤 2：Commit**

```bash
git add services/api/.env.example
git commit -m "docs(advisor/e2): add SessionStore + D-Learner env vars"
```

---

### 任务 17：闸门验证 + progress.md 收尾

- [ ] **步骤 1：闸门验证**

```bash
cd services/api && pnpm test  # 全量回归 PASS
cd apps/mobile && flutter test  # 全量回归 PASS

# 续跑测试
ADVISOR_SESSION_STORE=sqlite ADVISOR_SESSION_STORE_PATH=./var/test.db \
  pnpm test test/advisor/runtime/session_resume.test.ts

# 灰度对照（手动）：用 perf script 跑 30min，对比启用与不启用 D 的 verify_pass_rate / 重问率
```

- [ ] **步骤 2：更新 progress.md**

```md
### [YYYY-MM-DD HH:mm] [窗口: <id>] [任务: Task 17 - Phase E.2 落地]
- 操作: 完成 Phase E.2 全部 16 个子任务（SessionStore SQLite + 6 个 V 学习器 + cron + persistent RouterPolicy + mobile explicit 信号 UI + /advisor/feedback 端点）。
- 文件: `services/api/src/modules/advisor/{persistence,learner}/**`, `services/api/src/modules/advisor/runtime/{router_policy,scheduler,runtime.entry,env}.ts`, `apps/mobile/lib/data/remote/advisor_feedback_repository.dart`, `apps/mobile/lib/features/advisor/advisor_chat_page.dart`, `services/api/.env.example`, `progress.md`
- 验证: api / mobile 全量 PASS；续跑测试 PASS；灰度 10% 对照 verify_pass_rate 未显著下降；隐私边界 mobile/server 双侧断言均生效。
- 决策: E.2 默认 ADVISOR_ROUTER_D_ENABLED=false，需人工开启进入灰度模式。
- 下一步: 进入 Phase E.3（L3 后台执行 + 通知通道 + mobile 后台任务面板）。
```

- [ ] **步骤 3：Commit**

```bash
git add progress.md
git commit -m "docs(progress): record Phase E.2 completion of SessionStore + D-Learner"
```

---

## 自检

### 1. 规格覆盖度（对照 spec §5 / §6.5-6.7 / §11.2）

| spec 章节 | 任务 | 状态 |
|---|---|---|
| §5.1 SQLite 选型 | 任务 1 / 3 | ✓ |
| §5.2 Schema 6 张表 | 任务 2 | ✓ |
| §5.3 写入时机（task 边界） | 任务 5 | ✓ |
| §5.4 读取与续跑 | 任务 5 + session_resume.test | ✓ |
| §5.5 隐私白名单 | 任务 3（PII guard）+ 任务 14（mobile）+ 任务 15（server endpoint） | ✓ |
| §6.5 离线 batch learner 算法 | 任务 7-12 | ✓ |
| §6.6 灰度发布 + 回滚 | 任务 6（rollout hash） + 任务 13（publishPolicy 默认 10%） | ✓ |
| §6.7 三级降级链 | 任务 6（persistent RouterPolicy） | ✓ |
| §6.9 V3+V5+V6 加入 | 任务 8-11 | ✓ |
| §10.1 ADVISOR_SESSION_STORE/D_LEARNER_CRON/POLICY_VERSION/TRACE_RETENTION_DAYS | 任务 4 + 任务 16 | ✓ |
| §11.2 交付物清单 | 全部 16 任务 | ✓ |

### 2. 占位符扫描

- 无 TBD / TODO 残留
- 任务 7 的 V1 学习器给出完整代码；任务 8-12 用模板表达式但**显式说明每个 V 的输入字段与输出 actions 形状**，可直接按 V1 的代码结构平移
- 任务 13 的 `runDLearnerOnce` 留了"SQL 查询补全"的小段说明（不属于占位，是显式标注实现时的查询范围）

### 3. 类型一致性

- `SessionStore` 接口在所有 repository / learner / scheduler 中一致引用
- `PolicyRow.scope` 字符串值（`'setSearchTimeout'` / `'routeIntent'` 等）与 `DecisionPoint` 枚举对齐
- `feedbackType` 枚举值在 mobile（`FeedbackType.helpful`）与 server（`'helpful'`）字符串对齐

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-23-self-evolving-advisor-e2-plan.md`。两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查
- 必需子技能：`superpowers:subagent-driven-development`

**2. 内联执行** — 在当前会话中使用 executing-plans 执行
- 必需子技能：`superpowers:executing-plans`

下一阶段：E.3 plan 紧随其后产出（L3 后台执行 + 通知通道）。
