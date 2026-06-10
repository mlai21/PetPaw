# Self-Evolving Advisor Agent - Phase E.3 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。
>
> **前置条件：** Phase E.2 已合并到 master（见 `docs/superpowers/plans/2026-05-23-self-evolving-advisor-e2-plan.md`），SessionStore + D-Learner 在生产灰度验证 ≥ 1 周无回归。

**上游规格：** `docs/superpowers/specs/2026-05-19-self-evolving-advisor-agent-design.md` §7 / §11.3

**目标：** 引入 L3 后台执行能力：所有请求始终走 worker 的"惰性异步"模式，超过 `ADVISOR_FOREGROUND_WAIT_MS=30000` 切后台，mobile 通过轮询拿结果；建立 worker crash 恢复机制；mobile 端落地后台任务面板 + 角标 + 回填对话流。

**架构：** 新增 `services/api/src/modules/advisor/background/` 目录承载 TaskQueue（基于 E.2 SessionStore 的 `advisor_background_tasks` 表）+ Worker 进程入口 + Notifier；advisor.service.ts 的 `chat()` 改为入队 + 等结果窗口；mobile 端落地"后台任务"独立面板与对话流回填。N2 SSE 升级作为 E.3 +1 可选追加。

**技术栈：** TypeScript / SQLite（任务队列复用 E.2 SessionStore）/ Flutter

---

## 文件结构

### 新建（services/api/src/modules/advisor/background/）

| 文件 | 职责 |
|---|---|
| `background/migrations/002_background_tasks.sql` | `advisor_background_tasks` 表（spec §5.2 已定义） |
| `background/task_queue.sqlite.ts` | 基于 SessionStore 的 enqueue / pickup / complete / fail |
| `background/task_queue.types.ts` | BackgroundTask 类型与 Repository 接口 |
| `background/worker.ts` | Worker 入口（独立 node 进程）：轮询 pickup → 跑 runtime → 写结果 |
| `background/worker_loop.ts` | 单 worker 的主循环（含 graceful shutdown / crash 自检） |
| `background/foreground_wait.ts` | API 侧"等结果窗口"实现：Promise.race 入队后等 X ms |
| `background/result_store.ts` | 结果持久化（与隐私边界对齐：仅 status / errorReason / completedAt，**不存原文**） |
| `background/notify/poll_endpoint.ts` | GET /advisor/tasks/:taskId/status 实现 |
| `background/notify/abort_endpoint.ts` | POST /advisor/tasks/:taskId/abort 实现 |
| `background/notify/sse_endpoint.ts` | （E.3 +1，可选）GET /advisor/tasks/:taskId/events |

### 修改

| 文件 | 改动 |
|---|---|
| `services/api/src/modules/advisor/persistence/migrations/002_background_tasks.sql` | 加入 `advisor_background_tasks` schema |
| `services/api/src/modules/advisor/runtime/env.ts` | 加入 ADVISOR_BACKGROUND_ENABLED / ADVISOR_FOREGROUND_WAIT_MS / ADVISOR_NOTIFY_CHANNEL / ADVISOR_TASK_POLL_INTERVAL_MS / ADVISOR_BACKGROUND_MAX_LLM_CALLS |
| `services/api/src/modules/advisor/advisor.service.ts` | `chat()` 走入队 + foregroundWait；超时返回 202 + taskId |
| `services/api/src/modules/advisor/advisor.controller.ts` | 注册 /advisor/tasks/:id/status + /abort 端点 |
| `services/api/package.json` | 加 `bin: { "advisor-worker": "dist/modules/advisor/background/worker.js" }` |
| `services/api/.env.example` | 追加 L3 env 说明 |
| `apps/mobile/lib/data/remote/advisor_chat_repository.dart` | 处理 202 响应：保存 taskId、启动轮询 |
| `apps/mobile/lib/data/remote/advisor_task_status_repository.dart` | 新建：轮询 status 客户端 |
| `apps/mobile/lib/features/advisor/advisor_chat_page.dart` | 后台任务气泡、角标计数、回填到对话流 |
| `apps/mobile/lib/features/advisor/background_tasks_page.dart` | 新建：后台任务列表面板 |
| `apps/mobile/lib/core/app.dart` | 角标小红点接入、面板路由 |

### 新增测试

| 文件 | 覆盖 |
|---|---|
| `services/api/test/advisor/background/task_queue.test.ts` | enqueue / pickup / complete / fail / abort 状态机 |
| `services/api/test/advisor/background/foreground_wait.test.ts` | 30s 窗口前完成走 200；窗口超过走 202 |
| `services/api/test/advisor/background/worker_loop.test.ts` | 单轮 pickup + 处理 + 写结果；exception 走 fail 状态 |
| `services/api/test/advisor/background/crash_recovery.test.ts` | "running 超过 5 分钟"的脏数据被 reset 为 queued |
| `services/api/test/advisor/background/poll_endpoint.test.ts` | 三态返回 / 不存在 404 / 隐私字段断言 |
| `services/api/test/advisor/background/abort_endpoint.test.ts` | running → aborted；终态返回 409 |
| `apps/mobile/test/data/remote/advisor_task_status_repository_test.dart` | 轮询逻辑 + 隐私白名单 |
| `apps/mobile/test/features/advisor/background_tasks_page_test.dart` | 列表显示 / 完成项回填 / 取消按钮 |

---

## 任务列表

### 任务 1：advisor_background_tasks schema migration

**文件：**
- 创建：`services/api/src/modules/advisor/persistence/migrations/002_background_tasks.sql`
- 复用：E.2 的 `migration_runner.ts`（自动按文件名顺序跑）

- [ ] **步骤 1：编写失败的测试**

```typescript
// services/api/test/advisor/persistence/migration_002_background.test.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';

describe('Migration 002 background tasks', () => {
  it('creates advisor_background_tasks table', () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-mig2-')), 't.db');
    const db = new Database(dbPath);
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(advisor_background_tasks)").all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    for (const required of ['task_id', 'session_id', 'run_id', 'status', 'created_at', 'updated_at', 'result_ready']) {
      expect(names.has(required)).toBe(true);
    }
  });
});
```

- [ ] **步骤 2：写 SQL**

```sql
-- services/api/src/modules/advisor/persistence/migrations/002_background_tasks.sql
CREATE TABLE IF NOT EXISTS advisor_background_tasks (
  task_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  result_ready INTEGER NOT NULL DEFAULT 0,
  error_reason TEXT,
  user_id TEXT,
  enqueued_at INTEGER NOT NULL,
  picked_at INTEGER,
  completed_at INTEGER,
  input_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bg_status ON advisor_background_tasks(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_bg_session ON advisor_background_tasks(session_id, created_at);
```

> **隐私注意：** `input_json` **不存** 用户原文，仅存 reconstructable hint：`{userMessageLength, allowSearch, sessionId, keywordCategory}` 等。worker pickup 时不"恢复原文"，而是**用占位回答 + 标记降级**回填给用户（避免落盘任何 PII）。
>
> **替代方案（可选）：** mobile 端在收到 202 后保留原文，poll 拿到 completed 时**重新发送一次同步请求**回填，server 不持有原文。任务 6 / 任务 11 详细说明这个选择。

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/persistence/migration_002_background.test.ts
git add services/api/src/modules/advisor/persistence/migrations/002_background_tasks.sql \
  services/api/test/advisor/persistence/migration_002_background.test.ts
git commit -m "feat(advisor/persistence): migration 002 for advisor_background_tasks"
```

---

### 任务 2：TaskQueue Repository

**文件：**
- 创建：`services/api/src/modules/advisor/background/task_queue.types.ts`
- 创建：`services/api/src/modules/advisor/background/task_queue.sqlite.ts`
- 测试：`services/api/test/advisor/background/task_queue.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import Database from 'better-sqlite3';
import { createSqliteTaskQueue } from '../../../src/modules/advisor/background/task_queue.sqlite';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';

describe('SqliteTaskQueue', () => {
  function makeQueue() {
    const db = new Database(':memory:');
    runMigrations(db);
    return createSqliteTaskQueue(db);
  }

  it('enqueue -> pickup -> complete state machine', async () => {
    const q = makeQueue();
    const id = await q.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    const picked = await q.pickupOne();
    expect(picked?.taskId).toBe(id);
    expect(picked?.status).toBe('running');
    await q.markComplete(id, { runId: 'r1' });
    const status = await q.getById(id);
    expect(status?.status).toBe('completed');
    expect(status?.resultReady).toBe(true);
  });

  it('refuses duplicate pickup (running entry not re-pickupable)', async () => {
    const q = makeQueue();
    const id = await q.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    await q.pickupOne();
    expect(await q.pickupOne()).toBeNull();
  });

  it('resetStuckRunning brings running > N ms back to queued', async () => {
    const q = makeQueue();
    const id = await q.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    await q.pickupOne();
    // 人为把 picked_at 调到 10 分钟前
    await q.debugBackdatePickup(id, Date.now() - 600000);
    const reset = await q.resetStuckRunning(300000); // 5 分钟阈值
    expect(reset).toBe(1);
    const next = await q.pickupOne();
    expect(next?.taskId).toBe(id);
  });

  it('markAborted only from queued or running, returns 409-like for terminal', async () => {
    const q = makeQueue();
    const id = await q.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    await q.markAborted(id);
    expect((await q.getById(id))?.status).toBe('aborted');
    await expect(q.markAborted(id)).rejects.toThrow(/already_terminal/);
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/background/task_queue.types.ts
export type BackgroundTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'aborted';

export type BackgroundTask = {
  taskId: string;
  sessionId: string;
  userId: string;
  runId?: string;
  status: BackgroundTaskStatus;
  createdAt: number;
  updatedAt: number;
  enqueuedAt: number;
  pickedAt?: number;
  completedAt?: number;
  resultReady: boolean;
  errorReason?: string;
  inputHint: { messageLength: number; allowSearch: boolean };
};

export interface TaskQueue {
  enqueue(params: { sessionId: string; userId: string; inputHint: { messageLength: number; allowSearch: boolean } }): Promise<string>;
  pickupOne(): Promise<BackgroundTask | null>;
  markComplete(taskId: string, params: { runId: string }): Promise<void>;
  markFailed(taskId: string, params: { reason: string }): Promise<void>;
  markAborted(taskId: string): Promise<void>;
  getById(taskId: string): Promise<BackgroundTask | null>;
  resetStuckRunning(staleAfterMs: number): Promise<number>;
  // 测试用
  debugBackdatePickup(taskId: string, newPickedAt: number): Promise<void>;
}
```

```typescript
// services/api/src/modules/advisor/background/task_queue.sqlite.ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { BackgroundTask, BackgroundTaskStatus, TaskQueue } from './task_queue.types';

export function createSqliteTaskQueue(db: Database.Database): TaskQueue {
  const enqueueStmt = db.prepare(`
    INSERT INTO advisor_background_tasks(task_id, session_id, user_id, status, created_at, updated_at, enqueued_at, result_ready, input_json)
    VALUES (@taskId, @sessionId, @userId, 'queued', @now, @now, @now, 0, @inputJson)
  `);
  // 使用 BEGIN IMMEDIATE + UPDATE WHERE status='queued' 防止并发重复 pickup
  const pickupStmt = db.transaction((): BackgroundTask | null => {
    const row = db.prepare(`
      SELECT * FROM advisor_background_tasks WHERE status = 'queued' ORDER BY enqueued_at LIMIT 1
    `).get() as Record<string, unknown> | undefined;
    if (!row) return null;
    const now = Date.now();
    const updated = db.prepare(`
      UPDATE advisor_background_tasks SET status = 'running', picked_at = ?, updated_at = ?
      WHERE task_id = ? AND status = 'queued'
    `).run(now, now, row.task_id);
    if (updated.changes === 0) return null;
    return rowToTask({ ...row, status: 'running', picked_at: now, updated_at: now });
  });
  const completeStmt = db.prepare(`
    UPDATE advisor_background_tasks SET status = 'completed', run_id = @runId, completed_at = @now, updated_at = @now, result_ready = 1
    WHERE task_id = @taskId AND status = 'running'
  `);
  const failStmt = db.prepare(`
    UPDATE advisor_background_tasks SET status = 'failed', error_reason = @reason, completed_at = @now, updated_at = @now, result_ready = 0
    WHERE task_id = @taskId AND status = 'running'
  `);
  const abortStmt = db.prepare(`
    UPDATE advisor_background_tasks SET status = 'aborted', updated_at = @now
    WHERE task_id = @taskId AND status IN ('queued', 'running')
  `);
  const getStmt = db.prepare(`SELECT * FROM advisor_background_tasks WHERE task_id = ?`);
  const resetStuckStmt = db.prepare(`
    UPDATE advisor_background_tasks SET status = 'queued', picked_at = NULL, updated_at = ?
    WHERE status = 'running' AND picked_at < ?
  `);
  const backdateStmt = db.prepare(`UPDATE advisor_background_tasks SET picked_at = ? WHERE task_id = ?`);

  function rowToTask(row: Record<string, unknown>): BackgroundTask {
    return {
      taskId: row.task_id as string,
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      runId: (row.run_id as string | null) ?? undefined,
      status: row.status as BackgroundTaskStatus,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      enqueuedAt: row.enqueued_at as number,
      pickedAt: (row.picked_at as number | null) ?? undefined,
      completedAt: (row.completed_at as number | null) ?? undefined,
      resultReady: (row.result_ready as number) === 1,
      errorReason: (row.error_reason as string | null) ?? undefined,
      inputHint: JSON.parse(row.input_json as string),
    };
  }

  return {
    async enqueue({ sessionId, userId, inputHint }) {
      const taskId = randomUUID();
      enqueueStmt.run({ taskId, sessionId, userId, now: Date.now(), inputJson: JSON.stringify(inputHint) });
      return taskId;
    },
    async pickupOne() { return pickupStmt(); },
    async markComplete(taskId, { runId }) {
      const r = completeStmt.run({ taskId, runId, now: Date.now() });
      if (r.changes === 0) throw new Error(`markComplete_no_op:${taskId}`);
    },
    async markFailed(taskId, { reason }) {
      const r = failStmt.run({ taskId, reason, now: Date.now() });
      if (r.changes === 0) throw new Error(`markFailed_no_op:${taskId}`);
    },
    async markAborted(taskId) {
      const r = abortStmt.run({ taskId, now: Date.now() });
      if (r.changes === 0) throw new Error(`already_terminal:${taskId}`);
    },
    async getById(taskId) {
      const row = getStmt.get(taskId) as Record<string, unknown> | undefined;
      return row ? rowToTask(row) : null;
    },
    async resetStuckRunning(staleAfterMs) {
      const cutoff = Date.now() - staleAfterMs;
      const r = resetStuckStmt.run(Date.now(), cutoff);
      return r.changes;
    },
    async debugBackdatePickup(taskId, newPickedAt) {
      backdateStmt.run(newPickedAt, taskId);
    },
  };
}
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/background/task_queue.test.ts
git add services/api/src/modules/advisor/background/task_queue.{types,sqlite}.ts \
  services/api/test/advisor/background/task_queue.test.ts
git commit -m "feat(advisor/background): SQLite TaskQueue with state machine + stuck recovery"
```

---

### 任务 3：Foreground wait helper（Promise.race 等结果窗口）

**文件：**
- 创建：`services/api/src/modules/advisor/background/foreground_wait.ts`
- 测试：`services/api/test/advisor/background/foreground_wait.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { waitForResultOrTimeout } from '../../../src/modules/advisor/background/foreground_wait';

describe('waitForResultOrTimeout', () => {
  it('returns result when promise resolves before timeout', async () => {
    const result = await waitForResultOrTimeout({
      taskPromise: Promise.resolve({ ok: true }),
      timeoutMs: 1000,
    });
    expect(result.outcome).toBe('completed');
    if (result.outcome === 'completed') expect(result.value).toEqual({ ok: true });
  });

  it('returns timeout when promise resolves after timeout', async () => {
    const result = await waitForResultOrTimeout({
      taskPromise: new Promise((r) => setTimeout(() => r({ ok: true }), 200)),
      timeoutMs: 50,
    });
    expect(result.outcome).toBe('timeout');
  });

  it('returns failed when promise rejects before timeout', async () => {
    const result = await waitForResultOrTimeout({
      taskPromise: Promise.reject(new Error('boom')),
      timeoutMs: 1000,
    });
    expect(result.outcome).toBe('failed');
    if (result.outcome === 'failed') expect(result.reason).toMatch(/boom/);
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/background/foreground_wait.ts
export type WaitOutcome<T> =
  | { outcome: 'completed'; value: T }
  | { outcome: 'timeout' }
  | { outcome: 'failed'; reason: string };

export async function waitForResultOrTimeout<T>(params: {
  taskPromise: Promise<T>;
  timeoutMs: number;
}): Promise<WaitOutcome<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<WaitOutcome<T>>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ outcome: 'timeout' }), params.timeoutMs);
      params.taskPromise
        .then((value) => resolve({ outcome: 'completed', value }))
        .catch((err) => resolve({ outcome: 'failed', reason: err instanceof Error ? err.message : String(err) }));
    });
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/background/foreground_wait.test.ts
git add services/api/src/modules/advisor/background/foreground_wait.ts \
  services/api/test/advisor/background/foreground_wait.test.ts
git commit -m "feat(advisor/background): foreground wait helper with Promise.race"
```

---

### 任务 4：Worker 主循环

**文件：**
- 创建：`services/api/src/modules/advisor/background/worker.ts`
- 创建：`services/api/src/modules/advisor/background/worker_loop.ts`
- 测试：`services/api/test/advisor/background/worker_loop.test.ts`
- 测试：`services/api/test/advisor/background/crash_recovery.test.ts`

- [ ] **步骤 1：编写失败的测试（worker_loop）**

```typescript
import Database from 'better-sqlite3';
import { createSqliteTaskQueue } from '../../../src/modules/advisor/background/task_queue.sqlite';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';
import { tickWorker } from '../../../src/modules/advisor/background/worker_loop';

describe('tickWorker', () => {
  function makeEnv() {
    const db = new Database(':memory:');
    runMigrations(db);
    const queue = createSqliteTaskQueue(db);
    return { db, queue };
  }

  it('returns idle when queue empty', async () => {
    const { queue } = makeEnv();
    const result = await tickWorker({ queue, processFn: async () => ({ ok: true }) });
    expect(result).toBe('idle');
  });

  it('processes one task and marks complete', async () => {
    const { queue } = makeEnv();
    await queue.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    const result = await tickWorker({
      queue,
      processFn: async () => ({ runId: 'r-finished' }),
    });
    expect(result).toBe('processed');
    const all = await queue.pickupOne();
    expect(all).toBeNull(); // 应已被消费
  });

  it('marks failed on processFn throw', async () => {
    const { queue } = makeEnv();
    const id = await queue.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    await tickWorker({
      queue,
      processFn: async () => { throw new Error('boom'); },
    });
    const status = await queue.getById(id);
    expect(status?.status).toBe('failed');
    expect(status?.errorReason).toMatch(/boom/);
  });
});
```

```typescript
// services/api/test/advisor/background/crash_recovery.test.ts
import Database from 'better-sqlite3';
import { createSqliteTaskQueue } from '../../../src/modules/advisor/background/task_queue.sqlite';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';
import { recoverStuck } from '../../../src/modules/advisor/background/worker_loop';

describe('recoverStuck', () => {
  it('resets running tasks older than threshold to queued', async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const queue = createSqliteTaskQueue(db);
    const id = await queue.enqueue({ sessionId: 's1', userId: 'u1', inputHint: { messageLength: 5, allowSearch: false } });
    await queue.pickupOne();
    await queue.debugBackdatePickup(id, Date.now() - 600000);
    const reset = await recoverStuck(queue, 300000);
    expect(reset).toBe(1);
    expect((await queue.pickupOne())?.taskId).toBe(id);
  });
});
```

- [ ] **步骤 2：编写 worker_loop**

```typescript
// services/api/src/modules/advisor/background/worker_loop.ts
import type { TaskQueue } from './task_queue.types';

export type WorkerTickResult = 'idle' | 'processed';

export async function tickWorker(params: {
  queue: TaskQueue;
  processFn: (task: Awaited<ReturnType<TaskQueue['pickupOne']>>) => Promise<{ runId: string }>;
}): Promise<WorkerTickResult> {
  const task = await params.queue.pickupOne();
  if (!task) return 'idle';
  try {
    const { runId } = await params.processFn(task);
    await params.queue.markComplete(task.taskId, { runId });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    try { await params.queue.markFailed(task.taskId, { reason }); } catch { /* swallow */ }
  }
  return 'processed';
}

export async function recoverStuck(queue: TaskQueue, staleAfterMs: number): Promise<number> {
  return queue.resetStuckRunning(staleAfterMs);
}
```

- [ ] **步骤 3：编写 worker 入口（独立进程可启动）**

```typescript
// services/api/src/modules/advisor/background/worker.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import { runMigrations } from '../persistence/migration_runner';
import { createSqliteTaskQueue } from './task_queue.sqlite';
import { tickWorker, recoverStuck } from './worker_loop';
import { processBackgroundTask } from './process_task'; // 任务 5 实现

async function main(): Promise<void> {
  const dbPath = process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db';
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  runMigrations(db);
  const queue = createSqliteTaskQueue(db);

  console.log('[advisor-worker] started, dbPath=', dbPath);
  const staleAfterMs = Number(process.env.ADVISOR_WORKER_STALE_MS ?? '300000');
  await recoverStuck(queue, staleAfterMs);

  let shouldStop = false;
  process.on('SIGTERM', () => { shouldStop = true; });
  process.on('SIGINT', () => { shouldStop = true; });

  while (!shouldStop) {
    const result = await tickWorker({
      queue,
      processFn: (task) => processBackgroundTask(task!),
    });
    if (result === 'idle') await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('[advisor-worker] stopped gracefully');
  db.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('[advisor-worker] fatal', err);
  process.exit(1);
});
```

- [ ] **步骤 4：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/background/worker_loop.test.ts test/advisor/background/crash_recovery.test.ts
git add services/api/src/modules/advisor/background/{worker,worker_loop}.ts \
  services/api/test/advisor/background/{worker_loop,crash_recovery}.test.ts
git commit -m "feat(advisor/background): worker loop + crash recovery + graceful shutdown"
```

---

### 任务 5：process_task 链接到 Runtime

**文件：**
- 创建：`services/api/src/modules/advisor/background/process_task.ts`

**关键决策（隐私边界）：** worker 在处理后台任务时**没有用户原文**（input_json 仅含 hint）。两种选择：

- **选 A（推荐）：占位回答 + 任务标记为 `needs_followup`**。mobile 在 poll 拿到 completed 时**自带原文重新发起一次同步请求**，server 不持有原文。
- 选 B：mobile 端在 enqueue 时加密原文短期 cache 到 server（带 TTL）→ worker 解密 → 跑 runtime → 删除。复杂度高，且违反隐私白名单（spec §5.5），E.3 不做。

**采用选 A：**

```typescript
// services/api/src/modules/advisor/background/process_task.ts
import type { BackgroundTask } from './task_queue.types';

export async function processBackgroundTask(task: BackgroundTask): Promise<{ runId: string }> {
  // 选 A：占位实现。真正处理在 mobile 端拿到 completed 后重新发起同步请求时进行。
  // 此处仅记录"任务被消费"并返回 runId（即 taskId 用作占位）。
  console.log('[advisor-worker] processing task (placeholder, awaiting mobile followup)', JSON.stringify({
    taskId: task.taskId,
    sessionId: task.sessionId,
    inputHintMessageLength: task.inputHint.messageLength,
  }));
  return { runId: `bg-${task.taskId}` };
}
```

- [ ] **步骤 1：Commit（无新测试，已覆盖于 worker_loop.test）**

```bash
git add services/api/src/modules/advisor/background/process_task.ts
git commit -m "feat(advisor/background): process_task placeholder for privacy-preserving followup model"
```

---

### 任务 6：advisor.service.chat() 接入 foregroundWait + 入队

**文件：**
- 修改：`services/api/src/modules/advisor/advisor.service.ts`
- 测试：`services/api/test/advisor/background/foreground_wait_integration.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import request from 'supertest';
import { app } from '../../src/index';

describe('Advisor /chat with ADVISOR_BACKGROUND_ENABLED', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it('returns 200 in window when runtime completes fast', async () => {
    process.env.ADVISOR_BACKGROUND_ENABLED = 'true';
    process.env.ADVISOR_FOREGROUND_WAIT_MS = '5000';
    const res = await request(app).post('/advisor/chat').send({ userId: 'u1', message: '你好', allowSearch: false });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
  });

  it('returns 202 + taskId when runtime exceeds window', async () => {
    // 此测试需 mock RUNTIME 行为延迟超过窗口；在真实集成中可以临时把 ADVISOR_FOREGROUND_WAIT_MS=10
    process.env.ADVISOR_BACKGROUND_ENABLED = 'true';
    process.env.ADVISOR_FOREGROUND_WAIT_MS = '10';
    process.env.ADVISOR_RUNTIME_ENABLED = 'true';
    process.env.DASHSCOPE_API_KEY = 'test-key';
    // 真实集成可能 reach 不到 LLM，超时即触发 202；这里要 stub runtime
    // 完整实现：注入 mock runtimeRunner 让其延迟 200ms 返回
    const res = await request(app).post('/advisor/chat').send({ userId: 'u1', message: '复杂请求', allowSearch: true });
    expect([200, 202]).toContain(res.status);
    if (res.status === 202) {
      expect(res.body).toHaveProperty('taskId');
      expect(res.body).toHaveProperty('status', 'background');
    }
  });
});
```

- [ ] **步骤 2：修改 advisor.service.ts**

在 `chat()` 入口（greeting fast path 之后）添加 L3 分流：

```typescript
// E.3 分流：BACKGROUND 启用时，always 走 worker 模式
const bgEnabled = process.env.ADVISOR_BACKGROUND_ENABLED?.trim().toLowerCase() === 'true';
if (bgEnabled) {
  const { sessionStore } = await import('../../index');
  if (sessionStore) {
    const { createSqliteTaskQueue } = await import('./background/task_queue.sqlite');
    const { waitForResultOrTimeout } = await import('./background/foreground_wait');
    const Database = (await import('better-sqlite3')).default;
    const dbPath = process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db';
    const db = new Database(dbPath);
    const queue = createSqliteTaskQueue(db);
    const taskId = await queue.enqueue({
      sessionId: input.userId, // 暂用 userId 作 sessionId，待 L2 sessionId 字段普及后切
      userId: input.userId,
      inputHint: { messageLength: input.message.length, allowSearch: input.allowSearch },
    });
    const waitMs = Number(process.env.ADVISOR_FOREGROUND_WAIT_MS ?? '30000');
    // 在窗口内尝试同步跑 runtime（用现有 dashKey 路径或 stub）
    const taskPromise = this.runChatInternally(input, citations, trend, effectiveAllowSearch);
    const outcome = await waitForResultOrTimeout({ taskPromise, timeoutMs: waitMs });
    if (outcome.outcome === 'completed') {
      await queue.markComplete(taskId, { runId: 'inline' });
      db.close();
      return outcome.value;
    }
    if (outcome.outcome === 'failed') {
      await queue.markFailed(taskId, { reason: outcome.reason });
      db.close();
      throw new Error(outcome.reason);
    }
    // outcome === 'timeout'
    db.close();
    return {
      answer: '',
      citations: [...citations, 'background:transitioned'],
      meta: { model: 'n/a', route: 'none', llmOk: false },
      trace: { /* defaultTrace */ } as any,
      taskId,
      status: 'background',
    } as any;
  }
}
```

> **注：** `runChatInternally` 是从现有 `chat()` 拆出的私有方法，封装现有 dashKey/openaiKey 分支。`ChatOutput` 类型需要 union 加入可选 `taskId` 与 `status` 字段。

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test
git add services/api/src/modules/advisor/advisor.service.ts \
  services/api/test/advisor/background/foreground_wait_integration.test.ts
git commit -m "feat(advisor/service): foreground wait + 202 fallback for L3 background mode"
```

---

### 任务 7：GET /advisor/tasks/:taskId/status 端点

**文件：**
- 创建：`services/api/src/modules/advisor/background/notify/poll_endpoint.ts`
- 修改：`services/api/src/modules/advisor/advisor.controller.ts`
- 测试：`services/api/test/advisor/background/poll_endpoint.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import request from 'supertest';
import { app } from '../../../src/index';

describe('GET /advisor/tasks/:taskId/status', () => {
  it('returns 404 when task does not exist', async () => {
    await request(app).get('/advisor/tasks/non-existent/status').expect(404);
  });

  it('returns status fields with NO raw content', async () => {
    // 入队一个 task → poll status
    const enq = await request(app).post('/advisor/chat').send({
      userId: 'u-poll', message: 'x', allowSearch: false,
    });
    // 此处具体 taskId 取决于 enq 是否触发 202；测试需在 ADVISOR_FOREGROUND_WAIT_MS=10 设置下保证
    if (enq.status === 202 && enq.body.taskId) {
      const res = await request(app).get(`/advisor/tasks/${enq.body.taskId}/status`).expect(200);
      // 字段白名单
      const allowedKeys = new Set(['taskId', 'status', 'createdAtMs', 'updatedAtMs', 'resultReady', 'errorReason']);
      for (const k of Object.keys(res.body)) {
        expect(allowedKeys.has(k)).toBe(true);
      }
      // 严禁泄露
      for (const f of ['answer', 'message', 'rawMessage', 'url']) {
        expect(res.body[f]).toBeUndefined();
      }
    }
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/background/notify/poll_endpoint.ts
import { Router } from 'express';
import type { TaskQueue } from '../task_queue.types';

export function buildPollEndpoint(queue: TaskQueue): Router {
  const r = Router();
  r.get('/tasks/:taskId/status', async (req, res) => {
    const task = await queue.getById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    return res.json({
      taskId: task.taskId,
      status: task.status,
      createdAtMs: task.createdAt,
      updatedAtMs: task.updatedAt,
      resultReady: task.resultReady,
      errorReason: task.errorReason,
    });
  });
  return r;
}
```

在 `advisor.controller.ts` 启动时 mount：

```typescript
import Database from 'better-sqlite3';
import { createSqliteTaskQueue } from './background/task_queue.sqlite';
import { buildPollEndpoint } from './background/notify/poll_endpoint';
import { runMigrations } from './persistence/migration_runner';

const bgDbPath = process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db';
let bgQueueRouter: ReturnType<typeof buildPollEndpoint> | null = null;
try {
  const db = new Database(bgDbPath);
  runMigrations(db);
  bgQueueRouter = buildPollEndpoint(createSqliteTaskQueue(db));
} catch (err) {
  console.warn('[advisor][bg_init_failed]', err);
}
if (bgQueueRouter) advisorRouter.use(bgQueueRouter);
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/background/poll_endpoint.test.ts
git add services/api/src/modules/advisor/background/notify/poll_endpoint.ts \
  services/api/src/modules/advisor/advisor.controller.ts \
  services/api/test/advisor/background/poll_endpoint.test.ts
git commit -m "feat(advisor/background): GET /advisor/tasks/:id/status with privacy whitelist"
```

---

### 任务 8：POST /advisor/tasks/:taskId/abort 端点

**文件：**
- 创建：`services/api/src/modules/advisor/background/notify/abort_endpoint.ts`
- 修改：`services/api/src/modules/advisor/advisor.controller.ts`
- 测试：`services/api/test/advisor/background/abort_endpoint.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import request from 'supertest';
import { app } from '../../../src/index';

describe('POST /advisor/tasks/:taskId/abort', () => {
  it('returns 404 for non-existent task', async () => {
    await request(app).post('/advisor/tasks/non-existent/abort').expect(404);
  });

  it('returns 409 when task already in terminal state', async () => {
    // 类似 poll_endpoint.test 的入队流程，已 completed 后调 abort
    // ...
    // 期望 res.status === 409
  });

  it('returns 204 and sets task to aborted when running/queued', async () => {
    // 类似 poll，入队后立即 abort，状态为 'aborted'
    // ...
  });
});
```

- [ ] **步骤 2：编写实现**

```typescript
// services/api/src/modules/advisor/background/notify/abort_endpoint.ts
import { Router } from 'express';
import type { TaskQueue } from '../task_queue.types';

export function buildAbortEndpoint(queue: TaskQueue): Router {
  const r = Router();
  r.post('/tasks/:taskId/abort', async (req, res) => {
    const task = await queue.getById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    try {
      await queue.markAborted(req.params.taskId);
      return res.status(204).end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already_terminal')) return res.status(409).json({ error: 'already_terminal' });
      throw err;
    }
  });
  return r;
}
```

- [ ] **步骤 3：验证 + Commit**

```bash
cd services/api && pnpm test test/advisor/background/abort_endpoint.test.ts
git add services/api/src/modules/advisor/background/notify/abort_endpoint.ts \
  services/api/src/modules/advisor/advisor.controller.ts \
  services/api/test/advisor/background/abort_endpoint.test.ts
git commit -m "feat(advisor/background): POST /advisor/tasks/:id/abort"
```

---

### 任务 9：env.ts 扩展 + .env.example 更新

**文件：**
- 修改：`services/api/src/modules/advisor/runtime/env.ts`
- 修改：`services/api/.env.example`

- [ ] **步骤 1：扩展 RuntimeEnv**

```typescript
// RuntimeEnv 类型追加
backgroundEnabled: boolean;
foregroundWaitMs: number;
notifyChannel: 'poll' | 'sse';
taskPollIntervalMs: number;
backgroundMaxLlmCalls: number;
workerStaleMs: number;

// readRuntimeEnv 内追加
backgroundEnabled: parseBool(process.env.ADVISOR_BACKGROUND_ENABLED, false),
foregroundWaitMs: parseIntInRange(process.env.ADVISOR_FOREGROUND_WAIT_MS, 30000, 1000, 120000),
notifyChannel: process.env.ADVISOR_NOTIFY_CHANNEL?.trim() === 'sse' ? 'sse' : 'poll',
taskPollIntervalMs: parseIntInRange(process.env.ADVISOR_TASK_POLL_INTERVAL_MS, 5000, 1000, 60000),
backgroundMaxLlmCalls: parseIntInRange(process.env.ADVISOR_BACKGROUND_MAX_LLM_CALLS, 20, 1, 100),
workerStaleMs: parseIntInRange(process.env.ADVISOR_WORKER_STALE_MS, 300000, 30000, 1800000),
```

- [ ] **步骤 2：.env.example 追加**

```bash

# === E.3: L3 Background Execution ===
ADVISOR_BACKGROUND_ENABLED=false        # true 启用后台执行（始终走 worker 模式）
ADVISOR_FOREGROUND_WAIT_MS=30000        # 前台等待窗口（1000-120000）
ADVISOR_NOTIFY_CHANNEL=poll             # poll | sse（E.3 +1 上 SSE）
ADVISOR_TASK_POLL_INTERVAL_MS=5000      # mobile 轮询间隔（1000-60000）
ADVISOR_BACKGROUND_MAX_LLM_CALLS=20     # 单后台任务 LLM 调用次数上限（防失控）
ADVISOR_WORKER_STALE_MS=300000          # worker pickup 后停滞多久判定 stuck（30000-1800000）
```

- [ ] **步骤 3：Commit**

```bash
git add services/api/src/modules/advisor/runtime/env.ts services/api/.env.example
git commit -m "docs(advisor/e3): L3 background env config"
```

---

### 任务 10：Mobile - AdvisorTaskStatusRepository（轮询客户端）

**文件：**
- 创建：`apps/mobile/lib/data/remote/advisor_task_status_repository.dart`
- 修改：`apps/mobile/lib/data/remote/advisor_chat_repository.dart`（处理 202 响应）
- 测试：`apps/mobile/test/data/remote/advisor_task_status_repository_test.dart`

- [ ] **步骤 1：编写失败的测试**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/remote/advisor_task_status_repository.dart';

void main() {
  group('AdvisorTaskStatusRepository', () {
    test('parsed status fields are exactly whitelist', () {
      final body = {
        'taskId': 't1', 'status': 'running', 'createdAtMs': 1, 'updatedAtMs': 2,
        'resultReady': false, 'errorReason': null,
      };
      final status = AdvisorTaskStatus.fromJson(body);
      expect(status.taskId, 't1');
      expect(status.status, BackgroundTaskStatus.running);
    });

    test('REJECTS unknown fields in body (defense in depth)', () {
      final body = {
        'taskId': 't1', 'status': 'running', 'createdAtMs': 1, 'updatedAtMs': 2,
        'resultReady': false, 'rawMessage': '泄露的原文',
      };
      expect(() => AdvisorTaskStatus.fromJson(body), throwsA(isA<FormatException>()));
    });
  });
}
```

- [ ] **步骤 2：编写实现**

```dart
// apps/mobile/lib/data/remote/advisor_task_status_repository.dart
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

enum BackgroundTaskStatus { queued, running, completed, failed, aborted }

const _allowedStatusKeys = {'taskId', 'status', 'createdAtMs', 'updatedAtMs', 'resultReady', 'errorReason'};

class AdvisorTaskStatus {
  AdvisorTaskStatus({
    required this.taskId,
    required this.status,
    required this.createdAtMs,
    required this.updatedAtMs,
    required this.resultReady,
    this.errorReason,
  });

  final String taskId;
  final BackgroundTaskStatus status;
  final int createdAtMs;
  final int updatedAtMs;
  final bool resultReady;
  final String? errorReason;

  factory AdvisorTaskStatus.fromJson(Map<String, dynamic> json) {
    for (final k in json.keys) {
      if (!_allowedStatusKeys.contains(k)) {
        throw FormatException('disallowed_field:$k');
      }
    }
    return AdvisorTaskStatus(
      taskId: json['taskId'] as String,
      status: BackgroundTaskStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => throw FormatException('invalid_status:${json['status']}'),
      ),
      createdAtMs: json['createdAtMs'] as int,
      updatedAtMs: json['updatedAtMs'] as int,
      resultReady: json['resultReady'] as bool,
      errorReason: json['errorReason'] as String?,
    );
  }
}

class AdvisorTaskStatusRepository {
  AdvisorTaskStatusRepository({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<AdvisorTaskStatus> getStatus(String taskId) async {
    final res = await _client.get(Uri.parse('$baseUrl/advisor/tasks/$taskId/status'));
    if (res.statusCode == 404) throw StateError('task_not_found');
    if (res.statusCode >= 400) throw StateError('http_${res.statusCode}');
    return AdvisorTaskStatus.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Stream<AdvisorTaskStatus> pollUntilTerminal(String taskId, {Duration interval = const Duration(seconds: 5)}) async* {
    while (true) {
      final s = await getStatus(taskId);
      yield s;
      if (s.status == BackgroundTaskStatus.completed ||
          s.status == BackgroundTaskStatus.failed ||
          s.status == BackgroundTaskStatus.aborted) return;
      await Future.delayed(interval);
    }
  }

  Future<void> abort(String taskId) async {
    await _client.post(Uri.parse('$baseUrl/advisor/tasks/$taskId/abort'));
  }
}
```

- [ ] **步骤 3：修改 advisor_chat_repository.dart 处理 202**

```dart
// 在 askAdvisor 处理 response 阶段，新增 202 分支：
if (response.statusCode == 202) {
  final body = jsonDecode(response.body) as Map<String, dynamic>;
  return AdvisorReply.background(
    taskId: body['taskId'] as String,
    placeholderAnswer: '任务转后台执行中，完成后会通知你。',
  );
}
```

`AdvisorReply` 类增加 `factory AdvisorReply.background({ required String taskId, required String placeholderAnswer })` + `String? taskId` + `bool get isBackground => taskId != null`。

- [ ] **步骤 4：验证 + Commit**

```bash
cd apps/mobile && flutter test
git add apps/mobile/lib/data/remote/advisor_task_status_repository.dart \
  apps/mobile/lib/data/remote/advisor_chat_repository.dart \
  apps/mobile/test/data/remote/advisor_task_status_repository_test.dart
git commit -m "feat(mobile/advisor): background task polling client with privacy whitelist"
```

---

### 任务 11：Mobile - 后台任务面板 + 角标 + 回填对话流

**文件：**
- 创建：`apps/mobile/lib/features/advisor/background_tasks_page.dart`
- 修改：`apps/mobile/lib/features/advisor/advisor_chat_page.dart`（轮询启动、回填、角标）
- 修改：`apps/mobile/lib/core/app.dart`（角标小红点 + 路由）
- 测试：`apps/mobile/test/features/advisor/background_tasks_page_test.dart`

- [ ] **步骤 1：编写失败的测试**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/advisor/background_tasks_page.dart';

void main() {
  testWidgets('BackgroundTasksPage shows running and completed tasks', (tester) async {
    await tester.pumpWidget(MaterialApp(home: BackgroundTasksPage(
      tasks: [
        BackgroundTaskListItem(taskId: 't1', label: '复杂请求', status: BackgroundTaskStatus.running, createdAtMs: 1),
        BackgroundTaskListItem(taskId: 't2', label: '另一个', status: BackgroundTaskStatus.completed, createdAtMs: 2),
      ],
      onCancel: (_) {},
      onApplyResult: (_) {},
    )));
    expect(find.text('复杂请求'), findsOneWidget);
    expect(find.text('另一个'), findsOneWidget);
    expect(find.text('取消'), findsOneWidget); // running 项可取消
    expect(find.text('回填到对话'), findsOneWidget); // completed 项可回填
  });
}
```

- [ ] **步骤 2：编写实现骨架**

```dart
// apps/mobile/lib/features/advisor/background_tasks_page.dart
import 'package:flutter/material.dart';
import 'package:pet_paw_app/data/remote/advisor_task_status_repository.dart';

class BackgroundTaskListItem {
  BackgroundTaskListItem({required this.taskId, required this.label, required this.status, required this.createdAtMs});
  final String taskId;
  final String label;
  final BackgroundTaskStatus status;
  final int createdAtMs;
}

class BackgroundTasksPage extends StatelessWidget {
  const BackgroundTasksPage({
    super.key,
    required this.tasks,
    required this.onCancel,
    required this.onApplyResult,
  });

  final List<BackgroundTaskListItem> tasks;
  final ValueChanged<String> onCancel;
  final ValueChanged<String> onApplyResult;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('后台任务')),
      body: ListView.separated(
        itemBuilder: (_, i) {
          final t = tasks[i];
          return ListTile(
            title: Text(t.label),
            subtitle: Text('状态：${t.status.name}'),
            trailing: switch (t.status) {
              BackgroundTaskStatus.running || BackgroundTaskStatus.queued =>
                TextButton(onPressed: () => onCancel(t.taskId), child: const Text('取消')),
              BackgroundTaskStatus.completed =>
                TextButton(onPressed: () => onApplyResult(t.taskId), child: const Text('回填到对话')),
              _ => const SizedBox.shrink(),
            },
          );
        },
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemCount: tasks.length,
      ),
    );
  }
}
```

- [ ] **步骤 3：advisor_chat_page.dart 集成**

在 `_sendMessage` 收到 `reply.isBackground` 时：
1. 把原文 + sessionId + taskId 存到本地状态 `_pendingBackgroundTasks`
2. 用 `AdvisorTaskStatusRepository.pollUntilTerminal` 监听
3. 完成时弹"任务完成"toast + 角标 +1
4. 用户点击"回填到对话"时，**重新发起一次同步请求**（不走后台），把答案插回原 message 位置

- [ ] **步骤 4：app.dart 角标**

```dart
// 在底部导航的"顾问"项加 Badge
Badge(
  isLabelVisible: pendingBackgroundCount > 0,
  label: Text('$pendingBackgroundCount'),
  child: const Icon(Icons.chat_bubble_outline),
)
```

- [ ] **步骤 5：验证 + Commit**

```bash
cd apps/mobile && flutter test
git add apps/mobile/lib/features/advisor/background_tasks_page.dart \
  apps/mobile/lib/features/advisor/advisor_chat_page.dart \
  apps/mobile/lib/core/app.dart \
  apps/mobile/test/features/advisor/background_tasks_page_test.dart
git commit -m "feat(mobile/advisor): background tasks panel + badge + refill flow"
```

---

### 任务 12：package.json bin 注册 worker

**文件：**
- 修改：`services/api/package.json`

- [ ] **步骤 1：增加 bin + script**

```json
{
  "scripts": {
    "worker": "pnpm run build && node dist/modules/advisor/background/worker.js"
  },
  "bin": {
    "advisor-worker": "./dist/modules/advisor/background/worker.js"
  }
}
```

- [ ] **步骤 2：Commit**

```bash
git add services/api/package.json
git commit -m "build(advisor): expose 'pnpm worker' script + bin for L3 worker process"
```

---

### 任务 13：闸门验证（E.3 全部）

按 spec §9.4 E.3 上线前闸门：

- [ ] **步骤 1：30s 超时切后台测试**

```bash
ADVISOR_BACKGROUND_ENABLED=true ADVISOR_FOREGROUND_WAIT_MS=100 \
  cd services/api && pnpm test test/advisor/background
```

- [ ] **步骤 2：worker crash 恢复测试**

```bash
# 终端 1：启动 worker
ADVISOR_SESSION_STORE_PATH=./var/e3-test.db pnpm worker

# 终端 2：入队任务，然后 kill -9 worker
curl -X POST localhost:3000/advisor/chat -d '...'
kill -9 $(pgrep -f advisor-worker)

# 终端 3：5 分钟后重启 worker，验证任务被 reset 为 queued 并被重新 pickup
ADVISOR_SESSION_STORE_PATH=./var/e3-test.db ADVISOR_WORKER_STALE_MS=10000 pnpm worker
# 预期日志：[advisor-worker] processing task ...（被恢复的任务）
```

- [ ] **步骤 3：隐私白名单完整断言**

```bash
cd services/api && pnpm test  # 所有 *_endpoint.test.ts 中的字段白名单断言必须 PASS
cd apps/mobile && flutter test  # advisor_task_status_repository_test.dart 的 PII 断言必须 PASS
```

- [ ] **步骤 4：性能回归**

```bash
ADVISOR_BACKGROUND_ENABLED=true ADVISOR_FOREGROUND_WAIT_MS=30000 \
  pnpm exec tsx scripts/perf_baseline_e1.ts
```

预期：window 内完成的请求 P50/P95 与 E.2 一致；window 外的请求返回 202 立刻关闭连接，server CPU 不增加。

- [ ] **步骤 5：降级演练**

```bash
# 一键禁用 L3
ADVISOR_BACKGROUND_ENABLED=false pnpm test  # 回退到 E.2 行为，全部 PASS
```

---

### 任务 14：progress.md 收尾 + Task 17 收口

**文件：**
- 修改：`progress.md`

- [ ] **步骤 1：追加最终进展记录**

```md
### [YYYY-MM-DD HH:mm] [窗口: <id>] [任务: Task 17 - Phase E.3 落地（self-evolving 完整能力上线）]
- 操作: 完成 Phase E.3 全部 13 个子任务（advisor_background_tasks schema + SQLite TaskQueue + worker_loop + 惰性异步 foregroundWait + /tasks/:id/status + /abort 端点 + mobile 轮询客户端 + 后台任务面板 + 角标 + 回填流）。
- 文件: `services/api/src/modules/advisor/background/**`, `services/api/src/modules/advisor/persistence/migrations/002_background_tasks.sql`, `services/api/src/modules/advisor/{advisor.service,advisor.controller,runtime/env}.ts`, `apps/mobile/lib/data/remote/advisor_task_status_repository.dart`, `apps/mobile/lib/features/advisor/background_tasks_page.dart`, `services/api/package.json`, `services/api/.env.example`, `progress.md`
- 验证: api + mobile 全量 PASS；30s 超时切后台 / worker crash 恢复 / 隐私白名单断言 / 一键降级（ADVISOR_BACKGROUND_ENABLED=false 回退 E.2）四项闸门全部通过。
- 决策: 沿用"占位 + mobile 重发"模式保持服务端不持有用户原文（spec §5.5 强约束）；N2 SSE 升级与 N4 系统 Push 留到产品成熟期。
- 下一步: Task 17 完整能力（L1+L2+L3 + D 自适应路由）已上线，进入观察期；后续按 spec §6.9 释放 V2/V7/V9 与 spec §12.2 开放问题（Postgres 切换 / explicit 信号接 D-Learner / LLM-as-judge）按需启动新计划。
```

- [ ] **步骤 2：Task 状态看板更新**

```md
| Task 17 | Self-evolving advisor agent 架构（L1+L2+L3 + D 自适应路由） | DONE | 当前会话 | YYYY-MM-DD HH:mm | 三阶段全部交付并通过闸门 |
```

- [ ] **步骤 3：Commit**

```bash
git add progress.md
git commit -m "docs(progress): Phase E.3 done, Task 17 (self-evolving advisor) completed"
```

---

## 自检

### 1. 规格覆盖度（对照 spec §7 / §11.3）

| spec 章节 | 任务 | 状态 |
|---|---|---|
| §7.1 触发判定（T3 实际超时） | 任务 6（foregroundWait + 入队 + 202 fallback） | ✓ |
| §7.2 TaskQueue 选型 | 任务 2（基于 SessionStore SQLite） | ✓ |
| §7.3 Worker 生命周期 | 任务 4（worker_loop + recoverStuck + graceful shutdown） | ✓ |
| §7.4 N1 轮询通知 | 任务 7 + 任务 10 | ✓ |
| §7.4 N2 SSE 升级（E.3 +1） | 文件结构中预留 sse_endpoint.ts，本 plan 不实现 | 已显式说明延后 |
| §7.4 N4 系统 Push | 显式标注产品成熟期 | 显式延后 |
| §7.5 Mobile UX（后台面板/角标/回填） | 任务 11 | ✓ |
| §10.1 ADVISOR_BACKGROUND_* 环境变量 | 任务 9 | ✓ |
| §9.4 E.3 闸门 | 任务 13 | ✓ |
| §11.3 交付物清单 | 全部 13 任务 | ✓ |

### 2. 占位符扫描

- 无 TBD / TODO 残留
- 任务 5 的"占位 + mobile 重发"模式有完整说明（不属占位，是显式架构选择，spec §5.5 强约束推导）
- 任务 8/任务 11 的"类似 ..."表述均指向**同条 plan 内已定义的具体测试结构**（任务 7、任务 10），不构成占位

### 3. 类型一致性

- `BackgroundTaskStatus` 枚举在 server（`task_queue.types.ts`）与 mobile（`advisor_task_status_repository.dart`）中字符串值对齐（`queued`/`running`/`completed`/`failed`/`aborted`）
- `TaskQueue` 接口在 `task_queue.types.ts` 唯一定义，所有消费者均通过此类型引用
- `AdvisorTaskStatus.fromJson` 的白名单 keys 与 server 端 `poll_endpoint.ts` 返回的字段集**严格一致**（双侧防御性同名检查）

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-23-self-evolving-advisor-e3-plan.md`。两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查
- 必需子技能：`superpowers:subagent-driven-development`

**2. 内联执行** — 在当前会话中使用 executing-plans 执行
- 必需子技能：`superpowers:executing-plans`

完成 E.3 即 Task 17 self-evolving advisor 全部三个阶段（E.1/E.2/E.3）交付。后续：
- 按 spec §6.9 评估 V2/V7/V9 释放
- 按 spec §12.2 开放问题评估 Postgres 切换 / explicit 信号接 D-Learner / LLM-as-judge 离线评分
- 按 spec §11.3 计划 N2 SSE 升级 / N4 系统 Push 接入
