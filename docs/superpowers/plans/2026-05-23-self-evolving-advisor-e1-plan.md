# Self-Evolving Advisor Agent - Phase E.1 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**上游规格：** `docs/superpowers/specs/2026-05-19-self-evolving-advisor-agent-design.md` §4 / §6 / §11.1

**目标：** 把当前 advisor 的一次性请求级流水线升级为带 Runtime/Task 分层状态机的 in-process loop，配套 D 路由器内存版（仅滚动统计）+ 三级降级链；不引入持久化、不引入后台执行，对外 API 100% 向后兼容。

**架构：** 在 `services/api/src/modules/advisor/runtime/` 新建状态机层（Runtime + Task 两层）+ Scheduler + Agent Adapter + RouterPolicy；现有 5 个 agent 不重写，仅加 wrapper 暴露统一 `AgentResult.nextAction` 协议。所有改动通过 `ADVISOR_RUNTIME_ENABLED=true/false` 开关切换，关闭即完全回退到当前 master pipeline。

**技术栈：** TypeScript 5.8 / Node 22 / Express 4 / Jest 29 / supertest 7 / pnpm 11

---

## 文件结构

### 新建（services/api/src/modules/advisor/runtime/）

| 文件 | 职责 |
|---|---|
| `runtime/state_machine.types.ts` | Runtime 与 Task 状态枚举、状态转移定义、事件类型 |
| `runtime/runtime.state_machine.ts` | Runtime 5 态状态机的 reducer 实现 |
| `runtime/task.state_machine.ts` | Task 5 态状态机的 reducer 实现 |
| `runtime/agent_adapter.types.ts` | AgentResult / NextAction 统一协议类型 |
| `runtime/agent_adapter.ts` | 5 个 agent 的 wrapper 集合（intent/planner/executor/responder/verify） |
| `runtime/scheduler.ts` | 主调度器：消费 AgentResult、推进状态机、控制 turn 循环 |
| `runtime/router_policy.types.ts` | RouterDecision / DecisionPoint / RuntimeSignal 等类型 |
| `runtime/router_policy.memory.ts` | D 内存版：滚动窗口统计 + 三级降级链决策 |
| `runtime/runtime.entry.ts` | 对外入口：`runAdvisorRuntime(input)`，被 AdvisorService 调用 |
| `runtime/env.ts` | 集中读取/校验 ADVISOR_RUNTIME_* 环境变量 |
| `runtime/keyword_categories.ts` | 关键词分类配置（spec §6.4），E.1 仅放 5 个基础分类 |

### 修改

| 文件 | 改动 |
|---|---|
| `services/api/src/modules/advisor/agent_loop/types.ts` | 扩展 `AgentLoopEventName` 加入 task_* 事件；保留现有类型不破坏 |
| `services/api/src/modules/advisor/advisor.service.ts` | `chat()` 方法增加 RUNTIME_ENABLED 分流：开启走 `runAdvisorRuntime`，关闭走原 pipeline |
| `services/api/.env.example` | 增加 ADVISOR_RUNTIME_* 环境变量说明 |

### 新增测试（services/api/test/advisor/runtime/）

| 文件 | 覆盖 |
|---|---|
| `runtime/runtime_state_machine.test.ts` | Runtime 状态机所有合法转移 + 非法转移拒绝 |
| `runtime/task_state_machine.test.ts` | Task 状态机所有合法转移 + 重试边界 |
| `runtime/agent_adapter.test.ts` | 5 个 wrapper 各自的 nextAction 分支 |
| `runtime/scheduler.test.ts` | 调度器 turn 循环、maxTurns、Task 重试、致命失败 |
| `runtime/router_policy_memory.test.ts` | 三级降级链优先级 + 滚动统计窗口 |
| `runtime/runtime_e2e.test.ts` | 端到端 supertest 集成：开启 RUNTIME 与关闭 RUNTIME 行为对比 |
| `runtime/keyword_categories.test.ts` | 关键词分类归属规则 |

---

## 任务列表

### 任务 1：状态机类型定义

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/state_machine.types.ts`
- 修改：`services/api/src/modules/advisor/agent_loop/types.ts`（仅追加事件名，不改现有）

- [ ] **步骤 1：编写失败的测试**

创建 `services/api/test/advisor/runtime/state_machine_types.test.ts`：

```typescript
import {
  RUNTIME_STATES,
  TASK_STATES,
  isLegalRuntimeTransition,
  isLegalTaskTransition,
  type RuntimeState,
  type TaskState,
  type RuntimeEvent,
  type TaskEvent,
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/state_machine_types.test.ts
```

预期：FAIL，报错 `Cannot find module '.../runtime/state_machine.types'`。

- [ ] **步骤 3：编写最少实现代码**

创建 `services/api/src/modules/advisor/runtime/state_machine.types.ts`：

```typescript
export const RUNTIME_STATES = [
  'R_IDLE',
  'R_RUNNING',
  'R_COMPLETED',
  'R_FAILED',
  'R_ABORTED',
] as const;

export type RuntimeState = (typeof RUNTIME_STATES)[number];
export type RuntimeTerminalState = Extract<
  RuntimeState,
  'R_COMPLETED' | 'R_FAILED' | 'R_ABORTED'
>;

export const TASK_STATES = [
  'T_PENDING',
  'T_IN_PROGRESS',
  'T_DONE',
  'T_FAILED',
  'T_SKIPPED',
] as const;

export type TaskState = (typeof TASK_STATES)[number];
export type TaskTerminalState = Extract<TaskState, 'T_DONE' | 'T_FAILED' | 'T_SKIPPED'>;

export type RuntimeEvent =
  | { kind: 'start' }
  | { kind: 'all_tasks_done' }
  | { kind: 'critical_fail'; reason: string }
  | { kind: 'max_turns_exceeded' }
  | { kind: 'user_abort' }
  | { kind: 'runtime_timeout' };

export type TaskEvent =
  | { kind: 'pick' }
  | { kind: 'success' }
  | { kind: 'fail'; reason: string }
  | { kind: 'retry' }
  | { kind: 'exceed_retries' };

const RUNTIME_TRANSITIONS: Record<RuntimeState, Partial<Record<RuntimeEvent['kind'], RuntimeState>>> = {
  R_IDLE: { start: 'R_RUNNING' },
  R_RUNNING: {
    all_tasks_done: 'R_COMPLETED',
    critical_fail: 'R_FAILED',
    max_turns_exceeded: 'R_FAILED',
    user_abort: 'R_ABORTED',
    runtime_timeout: 'R_FAILED',
  },
  R_COMPLETED: {},
  R_FAILED: {},
  R_ABORTED: {},
};

const TASK_TRANSITIONS: Record<TaskState, Partial<Record<TaskEvent['kind'], TaskState>>> = {
  T_PENDING: { pick: 'T_IN_PROGRESS' },
  T_IN_PROGRESS: {
    success: 'T_DONE',
    fail: 'T_FAILED',
  },
  T_FAILED: {
    retry: 'T_PENDING',
    exceed_retries: 'T_SKIPPED',
  },
  T_DONE: {},
  T_SKIPPED: {},
};

export function isLegalRuntimeTransition(
  from: RuntimeState,
  to: RuntimeState,
  event: RuntimeEvent,
): boolean {
  return RUNTIME_TRANSITIONS[from][event.kind] === to;
}

export function isLegalTaskTransition(
  from: TaskState,
  to: TaskState,
  event: TaskEvent,
): boolean {
  return TASK_TRANSITIONS[from][event.kind] === to;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/state_machine_types.test.ts
```

预期：PASS。

- [ ] **步骤 5：扩展现有事件名（不破坏 stage A 已有事件）**

修改 `services/api/src/modules/advisor/agent_loop/types.ts`：

```typescript
// 在现有 AgentLoopEventName 联合类型中追加（保持现有元素不动）：
export type AgentLoopEventName =
  | 'loop_start'
  | 'loop_queued'
  | 'planner_start'
  | 'planner_done'
  | 'executor_start'
  | 'executor_done'
  | 'loop_end'
  // === E.1 新增 ===
  | 'runtime_start'
  | 'turn_start'
  | 'turn_complete'
  | 'task_start'
  | 'task_done'
  | 'task_failed'
  | 'task_skipped'
  | 'task_retried'
  | 'router_decision'
  | 'runtime_end';
```

- [ ] **步骤 6：运行所有现有测试确认零回归**

```bash
cd services/api && pnpm test
```

预期：所有现有 suites PASS（不应因 `AgentLoopEventName` 扩展破坏任何现有断言）。

- [ ] **步骤 7：Commit**

```bash
git add services/api/src/modules/advisor/runtime/state_machine.types.ts \
  services/api/src/modules/advisor/agent_loop/types.ts \
  services/api/test/advisor/runtime/state_machine_types.test.ts
git commit -m "feat(advisor/runtime): add Runtime/Task state machine type definitions"
```

---

### 任务 2：Runtime 状态机 reducer

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/runtime.state_machine.ts`
- 测试：`services/api/test/advisor/runtime/runtime_state_machine.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/runtime_state_machine.test.ts
```

预期：FAIL，`Cannot find module`。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/runtime.state_machine.ts
import {
  isLegalRuntimeTransition,
  type RuntimeEvent,
  type RuntimeState,
} from './state_machine.types';

export type RuntimeContext = {
  runId: string;
  sessionId: string;
  state: RuntimeState;
  turnIndex: number;
  startedAtMs?: number;
  endedAtMs?: number;
  terminalReason?: string;
};

const EVENT_TO_TARGET: Record<RuntimeEvent['kind'], RuntimeState> = {
  start: 'R_RUNNING',
  all_tasks_done: 'R_COMPLETED',
  critical_fail: 'R_FAILED',
  max_turns_exceeded: 'R_FAILED',
  user_abort: 'R_ABORTED',
  runtime_timeout: 'R_FAILED',
};

export function createRuntimeInitial(params: {
  runId: string;
  sessionId: string;
}): RuntimeContext {
  return {
    runId: params.runId,
    sessionId: params.sessionId,
    state: 'R_IDLE',
    turnIndex: 0,
  };
}

export function applyRuntimeEvent(
  ctx: RuntimeContext,
  event: RuntimeEvent,
): RuntimeContext {
  const target = EVENT_TO_TARGET[event.kind];
  if (!isLegalRuntimeTransition(ctx.state, target, event)) {
    throw new Error(
      `illegal runtime transition: ${ctx.state} --${event.kind}--> ${target}`,
    );
  }
  const now = Date.now();
  const next: RuntimeContext = { ...ctx, state: target };
  if (event.kind === 'start') {
    next.startedAtMs = now;
  }
  if (
    target === 'R_COMPLETED' ||
    target === 'R_FAILED' ||
    target === 'R_ABORTED'
  ) {
    next.endedAtMs = now;
  }
  if (event.kind === 'critical_fail') {
    next.terminalReason = `critical_fail:${event.reason}`;
  } else if (event.kind === 'max_turns_exceeded') {
    next.terminalReason = 'max_turns_exceeded';
  } else if (event.kind === 'user_abort') {
    next.terminalReason = 'user_abort';
  } else if (event.kind === 'runtime_timeout') {
    next.terminalReason = 'runtime_timeout';
  }
  return next;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/runtime_state_machine.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/runtime.state_machine.ts \
  services/api/test/advisor/runtime/runtime_state_machine.test.ts
git commit -m "feat(advisor/runtime): implement Runtime state machine reducer"
```

---

### 任务 3：Task 状态机 reducer

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/task.state_machine.ts`
- 测试：`services/api/test/advisor/runtime/task_state_machine.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/task_state_machine.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/task.state_machine.ts
import {
  isLegalTaskTransition,
  type TaskEvent,
  type TaskState,
} from './state_machine.types';

export type TaskContext = {
  taskId: string;
  title: string;
  needSearch: boolean;
  state: TaskState;
  retryCount: number;
  maxRetries: number;
  lastFailureReason?: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

const EVENT_TO_TARGET: Record<TaskEvent['kind'], TaskState> = {
  pick: 'T_IN_PROGRESS',
  success: 'T_DONE',
  fail: 'T_FAILED',
  retry: 'T_PENDING',
  exceed_retries: 'T_SKIPPED',
};

export function createTaskInitial(params: {
  taskId: string;
  title: string;
  needSearch: boolean;
  maxRetries: number;
}): TaskContext {
  return {
    taskId: params.taskId,
    title: params.title,
    needSearch: params.needSearch,
    state: 'T_PENDING',
    retryCount: 0,
    maxRetries: params.maxRetries,
  };
}

export function applyTaskEvent(ctx: TaskContext, event: TaskEvent): TaskContext {
  const target = EVENT_TO_TARGET[event.kind];
  if (!isLegalTaskTransition(ctx.state, target, event)) {
    throw new Error(
      `illegal task transition: ${ctx.state} --${event.kind}--> ${target}`,
    );
  }
  const now = Date.now();
  const next: TaskContext = { ...ctx, state: target };
  if (event.kind === 'pick' && next.startedAtMs === undefined) {
    next.startedAtMs = now;
  }
  if (event.kind === 'fail') {
    next.lastFailureReason = event.reason;
  }
  if (event.kind === 'retry') {
    next.retryCount = ctx.retryCount + 1;
  }
  if (
    target === 'T_DONE' ||
    target === 'T_SKIPPED'
  ) {
    next.endedAtMs = now;
  }
  return next;
}

export function shouldRetry(task: TaskContext): boolean {
  return task.state === 'T_FAILED' && task.retryCount < task.maxRetries;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/task_state_machine.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/task.state_machine.ts \
  services/api/test/advisor/runtime/task_state_machine.test.ts
git commit -m "feat(advisor/runtime): implement Task state machine reducer with retry semantics"
```

---

### 任务 4：AgentResult 统一协议

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/agent_adapter.types.ts`
- 测试：在任务 5 一并测（类型定义本身无行为，靠 adapter 测试覆盖）

- [ ] **步骤 1：编写类型定义**

```typescript
// services/api/src/modules/advisor/runtime/agent_adapter.types.ts
import type { ExecutionStep, PlanTask } from '../agent_loop/types';

export type NextAction =
  | { kind: 'continue' }
  | { kind: 'retry_task'; taskId: string }
  | { kind: 'replan'; reason: string }
  | { kind: 'abort'; reason: string }
  | { kind: 'done'; finalAnswer: string };

export type AgentTrace = {
  agentName: 'intent' | 'planner' | 'executor' | 'responder' | 'verify';
  durationMs: number;
  model: string;
  skipped: boolean;
  reason?: string;
  toolUsed?: ExecutionStep['tool'];
  toolResult?: 'success' | 'fail' | 'empty';
};

export type AgentResult<T> = {
  data: T;
  nextAction: NextAction;
  trace: AgentTrace;
};

export type IntentData = {
  needPlan: boolean;
  reason: string;
  directAnswer: string;
};

export type PlannerData = {
  tasks: PlanTask[];
  rawText: string;
  answerDraft: string;
};

export type ExecutorData = {
  steps: ExecutionStep[];
  notes: string[];
};

export type ResponderData = {
  answer: string;
  rawText: string;
  userPayload: string;
};

export type VerifyData = {
  answer: string;
  rawText: string;
  fallback: boolean;
};
```

- [ ] **步骤 2：Commit（无测试，类型在任务 5 验证）**

```bash
git add services/api/src/modules/advisor/runtime/agent_adapter.types.ts
git commit -m "feat(advisor/runtime): define AgentResult unified protocol types"
```

---

### 任务 5：5 个 Agent Wrapper

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/agent_adapter.ts`
- 测试：`services/api/test/advisor/runtime/agent_adapter.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import {
  adaptIntent,
  adaptPlanner,
  adaptExecutor,
  adaptResponder,
  adaptVerify,
} from '../../../src/modules/advisor/runtime/agent_adapter';

describe('Agent wrappers (E.1)', () => {
  describe('adaptIntent', () => {
    it('returns done with directAnswer when needPlan=false', () => {
      const result = adaptIntent({
        needPlan: false,
        reason: 'fast-path',
        directAnswer: '你好，我在。',
        rawText: '',
      }, { durationMs: 10, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      if (result.nextAction.kind === 'done') {
        expect(result.nextAction.finalAnswer).toBe('你好，我在。');
      }
      expect(result.trace.agentName).toBe('intent');
    });

    it('returns continue when needPlan=true', () => {
      const result = adaptIntent({
        needPlan: true,
        reason: 'complex-question',
        directAnswer: '',
        rawText: '',
      }, { durationMs: 10, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('continue');
    });
  });

  describe('adaptExecutor', () => {
    it('returns retry_task on the first failed step', () => {
      const result = adaptExecutor({
        steps: [
          { taskId: 't-1', title: 't1', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'ok' },
          { taskId: 't-2', title: 't2', status: 'failed', tool: 'bailian-search', inputSummary: 'q', outputSummary: 'err' },
        ],
        notes: ['bailian_failed:t-2:timeout'],
      }, { durationMs: 100, model: 'n/a' });
      expect(result.nextAction.kind).toBe('retry_task');
      if (result.nextAction.kind === 'retry_task') {
        expect(result.nextAction.taskId).toBe('t-2');
      }
    });

    it('returns continue when all steps done', () => {
      const result = adaptExecutor({
        steps: [
          { taskId: 't-1', title: 't1', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'ok' },
        ],
        notes: ['tavily_ok:t-1'],
      }, { durationMs: 100, model: 'n/a' });
      expect(result.nextAction.kind).toBe('continue');
    });
  });

  describe('adaptVerify', () => {
    it('returns done with verify.answer when not fallback', () => {
      const result = adaptVerify({
        answer: '校验后的答案',
        rawText: '...',
        fallback: false,
      }, { durationMs: 50, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      if (result.nextAction.kind === 'done') {
        expect(result.nextAction.finalAnswer).toBe('校验后的答案');
      }
    });

    it('returns done with fallback answer + reason in trace when fallback=true', () => {
      const result = adaptVerify({
        answer: '草稿答案',
        rawText: '',
        fallback: true,
      }, { durationMs: 0, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      expect(result.trace.skipped).toBe(true);
      expect(result.trace.reason).toMatch(/verify-fallback/);
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/agent_adapter.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/agent_adapter.ts
import type {
  AgentResult,
  AgentTrace,
  ExecutorData,
  IntentData,
  PlannerData,
  ResponderData,
  VerifyData,
} from './agent_adapter.types';

type TraceBase = { durationMs: number; model: string };

function makeTrace(
  agentName: AgentTrace['agentName'],
  base: TraceBase,
  extras: Partial<AgentTrace> = {},
): AgentTrace {
  return {
    agentName,
    durationMs: base.durationMs,
    model: base.model,
    skipped: false,
    ...extras,
  };
}

export function adaptIntent(
  data: IntentData & { rawText: string },
  trace: TraceBase,
): AgentResult<IntentData> {
  if (!data.needPlan && data.directAnswer.trim().length > 0) {
    return {
      data,
      nextAction: { kind: 'done', finalAnswer: data.directAnswer },
      trace: makeTrace('intent', trace),
    };
  }
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('intent', trace),
  };
}

export function adaptPlanner(
  data: PlannerData,
  trace: TraceBase,
): AgentResult<PlannerData> {
  if (data.tasks.length === 0) {
    return {
      data,
      nextAction: { kind: 'abort', reason: 'planner_no_tasks' },
      trace: makeTrace('planner', trace),
    };
  }
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('planner', trace),
  };
}

export function adaptExecutor(
  data: ExecutorData,
  trace: TraceBase,
): AgentResult<ExecutorData> {
  const firstFailed = data.steps.find((step) => step.status === 'failed');
  if (firstFailed) {
    return {
      data,
      nextAction: { kind: 'retry_task', taskId: firstFailed.taskId },
      trace: makeTrace('executor', trace, {
        toolUsed: firstFailed.tool,
        toolResult: 'fail',
      }),
    };
  }
  const firstDone = data.steps.find((step) => step.status === 'done');
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('executor', trace, {
      toolUsed: firstDone?.tool,
      toolResult: firstDone ? 'success' : 'empty',
    }),
  };
}

export function adaptResponder(
  data: ResponderData,
  trace: TraceBase,
): AgentResult<ResponderData> {
  return {
    data,
    nextAction: { kind: 'continue' },
    trace: makeTrace('responder', trace),
  };
}

export function adaptVerify(
  data: VerifyData,
  trace: TraceBase,
): AgentResult<VerifyData> {
  return {
    data,
    nextAction: { kind: 'done', finalAnswer: data.answer },
    trace: makeTrace('verify', trace, {
      skipped: data.fallback,
      reason: data.fallback ? 'verify-fallback' : undefined,
    }),
  };
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/agent_adapter.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/agent_adapter.ts \
  services/api/test/advisor/runtime/agent_adapter.test.ts
git commit -m "feat(advisor/runtime): add wrappers for 5 agents exposing nextAction protocol"
```

---

### 任务 6：环境变量集中读取

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/env.ts`
- 测试：`services/api/test/advisor/runtime/env.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/env.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/env.ts
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
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/env.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/env.ts \
  services/api/test/advisor/runtime/env.test.ts
git commit -m "feat(advisor/runtime): centralize ADVISOR_RUNTIME_* env parsing"
```

---

### 任务 7：关键词分类配置

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/keyword_categories.ts`
- 测试：`services/api/test/advisor/runtime/keyword_categories.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { classifyKeywords } from '../../../src/modules/advisor/runtime/keyword_categories';

describe('classifyKeywords', () => {
  it('returns null for empty / non-matching text', () => {
    expect(classifyKeywords('')).toBeNull();
    expect(classifyKeywords('随便聊一聊')).toBeNull();
  });

  it('returns weather for 天气 / 下雨', () => {
    expect(classifyKeywords('明天上海会下雨吗')).toBe('weather');
    expect(classifyKeywords('北京今天的天气怎么样')).toBe('weather');
  });

  it('returns current_affairs for 时事关键词', () => {
    expect(classifyKeywords('习近平今天访华了吗')).toBe('current_affairs');
  });

  it('returns tech for 科技/编程关键词', () => {
    expect(classifyKeywords('react 18 的新特性')).toBe('tech');
  });

  it('picks the category with the highest cumulative weight on conflict', () => {
    // "搜索" 在 explicit_search 的 weight 高
    expect(classifyKeywords('帮我搜索一下天气')).toBe('explicit_search');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/keyword_categories.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/keyword_categories.ts
export type KeywordCategory =
  | 'weather'
  | 'current_affairs'
  | 'tech'
  | 'explicit_search'
  | 'realtime_lookup';

type Rule = { keyword: string; category: KeywordCategory; weight: number };

const RULES: Rule[] = [
  { keyword: '天气', category: 'weather', weight: 1.0 },
  { keyword: '下雨', category: 'weather', weight: 1.0 },
  { keyword: '气温', category: 'weather', weight: 1.0 },
  { keyword: '降雨', category: 'weather', weight: 1.0 },
  { keyword: '今天', category: 'current_affairs', weight: 0.5 },
  { keyword: '访华', category: 'current_affairs', weight: 1.0 },
  { keyword: '访美', category: 'current_affairs', weight: 1.0 },
  { keyword: '新闻', category: 'current_affairs', weight: 1.0 },
  { keyword: 'react', category: 'tech', weight: 1.0 },
  { keyword: 'python', category: 'tech', weight: 1.0 },
  { keyword: '编程', category: 'tech', weight: 1.0 },
  { keyword: '搜索', category: 'explicit_search', weight: 1.5 },
  { keyword: '检索', category: 'explicit_search', weight: 1.5 },
  { keyword: '查询', category: 'explicit_search', weight: 1.0 },
  { keyword: '股价', category: 'realtime_lookup', weight: 1.5 },
  { keyword: '汇率', category: 'realtime_lookup', weight: 1.5 },
];

export function classifyKeywords(text: string): KeywordCategory | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  const sums = new Map<KeywordCategory, number>();
  for (const rule of RULES) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      sums.set(rule.category, (sums.get(rule.category) ?? 0) + rule.weight);
    }
  }
  if (sums.size === 0) return null;
  let bestCategory: KeywordCategory | null = null;
  let bestWeight = -Infinity;
  for (const [category, weight] of sums.entries()) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestCategory = category;
    }
  }
  return bestCategory;
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/keyword_categories.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/keyword_categories.ts \
  services/api/test/advisor/runtime/keyword_categories.test.ts
git commit -m "feat(advisor/runtime): add keyword classification with weight-based tie-break"
```

---

### 任务 8：RouterPolicy 内存版 + 三级降级链

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/router_policy.types.ts`
- 创建：`services/api/src/modules/advisor/runtime/router_policy.memory.ts`
- 测试：`services/api/test/advisor/runtime/router_policy_memory.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import {
  createMemoryRouterPolicy,
} from '../../../src/modules/advisor/runtime/router_policy.memory';

describe('Memory RouterPolicy (E.1) - three-tier degradation chain', () => {
  const baseInput = {
    decisionPoint: 'setSearchTimeout' as const,
    signal: {
      messageLengthBucket: 'short' as const,
      keywordCategory: null,
      recentToolFailureRate: 0,
      recentVerifyFailRate: 0,
    },
    defaults: { value: 12000 },
  };

  it('returns default when D disabled and no human override', () => {
    const policy = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });
    const result = policy.decide(baseInput);
    expect(result.source).toBe('default');
    expect(result.value).toBe(12000);
  });

  it('returns human override even when D enabled', () => {
    const policy = createMemoryRouterPolicy({ enabled: true, mode: 'rolling_stats_only' });
    const result = policy.decide({
      ...baseInput,
      humanOverride: { value: 5000, reason: 'env_set' },
    });
    expect(result.source).toBe('human_override');
    expect(result.value).toBe(5000);
  });

  it('returns rolling-stats decision when D enabled and signal triggers', () => {
    const policy = createMemoryRouterPolicy({ enabled: true, mode: 'rolling_stats_only' });
    // 模拟"近期失败率高"
    for (let i = 0; i < 10; i++) {
      policy.recordSignal({ toolResult: 'fail' });
    }
    const result = policy.decide({
      ...baseInput,
      signal: { ...baseInput.signal, recentToolFailureRate: 0.7 },
    });
    expect(result.source).toBe('d_policy');
    // 高失败率 -> 缩短超时
    expect(result.value).toBeLessThan(12000);
  });

  it('rolling stats window evicts old entries', async () => {
    const policy = createMemoryRouterPolicy({
      enabled: true,
      mode: 'rolling_stats_only',
      windowMs: 50,
    });
    policy.recordSignal({ toolResult: 'fail' });
    const initial = policy.getStats();
    expect(initial.toolFailureCount).toBe(1);
    await new Promise((r) => setTimeout(r, 80));
    const evicted = policy.getStats();
    expect(evicted.toolFailureCount).toBe(0);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/router_policy_memory.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/router_policy.types.ts
import type { KeywordCategory } from './keyword_categories';

export type DecisionPoint =
  | 'routeIntent'
  | 'setSearchTimeout'
  | 'setMaxTurns';

export type RuntimeSignal = {
  messageLengthBucket: 'short' | 'medium' | 'long';
  keywordCategory: KeywordCategory | null;
  recentToolFailureRate: number;
  recentVerifyFailRate: number;
};

export type RouterDecisionInput<T> = {
  decisionPoint: DecisionPoint;
  signal: RuntimeSignal;
  defaults: { value: T };
  humanOverride?: { value: T; reason: string };
};

export type RouterDecision<T> =
  | { source: 'human_override'; value: T; reason: string }
  | { source: 'd_policy'; value: T; policyVersion: string }
  | { source: 'default'; value: T };

export type RouterPolicy = {
  decide<T>(input: RouterDecisionInput<T>): RouterDecision<T>;
  recordSignal(event: { toolResult?: 'success' | 'fail' | 'empty'; verifyOutcome?: 'pass' | 'fail' }): void;
  getStats(): RollingStats;
};

export type RollingStats = {
  toolFailureCount: number;
  toolTotalCount: number;
  verifyFailCount: number;
  verifyTotalCount: number;
};
```

```typescript
// services/api/src/modules/advisor/runtime/router_policy.memory.ts
import type {
  RollingStats,
  RouterDecision,
  RouterDecisionInput,
  RouterPolicy,
} from './router_policy.types';

type SignalRecord = {
  timestampMs: number;
  toolResult?: 'success' | 'fail' | 'empty';
  verifyOutcome?: 'pass' | 'fail';
};

type Options = {
  enabled: boolean;
  mode: 'rolling_stats_only' | 'with_policy_table';
  windowMs?: number;
};

const POLICY_VERSION_MEMORY = 'memory-rolling-v1';

export function createMemoryRouterPolicy(options: Options): RouterPolicy {
  const windowMs = options.windowMs ?? 300000;
  let records: SignalRecord[] = [];

  function prune(now: number): void {
    const cutoff = now - windowMs;
    if (records.length === 0 || records[0].timestampMs >= cutoff) return;
    records = records.filter((r) => r.timestampMs >= cutoff);
  }

  function computeStats(): RollingStats {
    prune(Date.now());
    const stats: RollingStats = {
      toolFailureCount: 0,
      toolTotalCount: 0,
      verifyFailCount: 0,
      verifyTotalCount: 0,
    };
    for (const r of records) {
      if (r.toolResult) {
        stats.toolTotalCount += 1;
        if (r.toolResult === 'fail') stats.toolFailureCount += 1;
      }
      if (r.verifyOutcome) {
        stats.verifyTotalCount += 1;
        if (r.verifyOutcome === 'fail') stats.verifyFailCount += 1;
      }
    }
    return stats;
  }

  function decideDPolicy<T>(input: RouterDecisionInput<T>): T | null {
    if (input.decisionPoint === 'setSearchTimeout') {
      if (input.signal.recentToolFailureRate > 0.5) {
        // 高失败率 -> 缩短超时为默认的一半（不低于 3000ms）
        const defaultValue = input.defaults.value as unknown as number;
        const next = Math.max(3000, Math.floor(defaultValue / 2));
        return next as unknown as T;
      }
    }
    if (input.decisionPoint === 'setMaxTurns') {
      if (input.signal.recentVerifyFailRate > 0.4) {
        const defaultValue = input.defaults.value as unknown as number;
        return (defaultValue + 1) as unknown as T;
      }
    }
    if (input.decisionPoint === 'routeIntent') {
      if (input.signal.keywordCategory === 'explicit_search') {
        return true as unknown as T;
      }
    }
    return null;
  }

  return {
    decide<T>(input: RouterDecisionInput<T>): RouterDecision<T> {
      if (input.humanOverride) {
        return {
          source: 'human_override',
          value: input.humanOverride.value,
          reason: input.humanOverride.reason,
        };
      }
      if (options.enabled) {
        const dValue = decideDPolicy(input);
        if (dValue !== null) {
          return { source: 'd_policy', value: dValue, policyVersion: POLICY_VERSION_MEMORY };
        }
      }
      return { source: 'default', value: input.defaults.value };
    },
    recordSignal(event) {
      const now = Date.now();
      prune(now);
      records.push({ timestampMs: now, ...event });
    },
    getStats() {
      return computeStats();
    },
  };
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/router_policy_memory.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/router_policy.types.ts \
  services/api/src/modules/advisor/runtime/router_policy.memory.ts \
  services/api/test/advisor/runtime/router_policy_memory.test.ts
git commit -m "feat(advisor/runtime): add memory RouterPolicy with three-tier degradation"
```

---

### 任务 9：Scheduler 主调度器

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/scheduler.ts`
- 测试：`services/api/test/advisor/runtime/scheduler.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { runScheduler } from '../../../src/modules/advisor/runtime/scheduler';
import { createMemoryRouterPolicy } from '../../../src/modules/advisor/runtime/router_policy.memory';
import type { PlanTask } from '../../../src/modules/advisor/agent_loop/types';

describe('Scheduler (E.1) - turn loop and task retry', () => {
  const router = createMemoryRouterPolicy({ enabled: false, mode: 'rolling_stats_only' });

  it('finishes at R_COMPLETED when intent says direct answer', async () => {
    const result = await runScheduler({
      runId: 'r1',
      sessionId: 's1',
      userMessage: '你好',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: false, reason: 'fast', directAnswer: '你好', rawText: '' },
          nextAction: { kind: 'done', finalAnswer: '你好' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => { throw new Error('should not be called'); },
        executor: async () => { throw new Error('should not be called'); },
        responder: async () => { throw new Error('should not be called'); },
        verify: async () => { throw new Error('should not be called'); },
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(result.finalAnswer).toBe('你好');
    expect(result.totalTurns).toBe(0);
  });

  it('runs full pipeline when intent needPlan=true', async () => {
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'needs data', needSearch: true }];
    const result = await runScheduler({
      runId: 'r2',
      sessionId: 's2',
      userMessage: '最新天气',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'search', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => ({
          data: {
            steps: [{ taskId: 't1', title: 'search', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'http://x' }],
            notes: ['tavily_ok:t1'],
          },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'executor', durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'tavily-search', toolResult: 'success' },
        }),
        responder: async () => ({
          data: { answer: '答案', rawText: '', userPayload: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'responder', durationMs: 1, model: 'm', skipped: false },
        }),
        verify: async () => ({
          data: { answer: '答案', rawText: '', fallback: false },
          nextAction: { kind: 'done', finalAnswer: '答案' },
          trace: { agentName: 'verify', durationMs: 1, model: 'm', skipped: false },
        }),
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(result.finalAnswer).toBe('答案');
    expect(result.totalTurns).toBe(1);
  });

  it('retries task on executor failure within maxRetries, then proceeds', async () => {
    let executorCalls = 0;
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'r', needSearch: true }];
    const result = await runScheduler({
      runId: 'r3',
      sessionId: 's3',
      userMessage: 'q',
      maxTurns: 3,
      maxTasks: 4,
      taskMaxRetries: 1,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'r', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => {
          executorCalls += 1;
          if (executorCalls === 1) {
            return {
              data: { steps: [{ taskId: 't1', title: 'search', status: 'failed' as const, tool: 'bailian-search' as const, inputSummary: 'q', outputSummary: 'timeout' }], notes: ['bailian_failed:t1:timeout'] },
              nextAction: { kind: 'retry_task' as const, taskId: 't1' },
              trace: { agentName: 'executor' as const, durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'bailian-search' as const, toolResult: 'fail' as const },
            };
          }
          return {
            data: { steps: [{ taskId: 't1', title: 'search', status: 'done' as const, tool: 'tavily-search' as const, inputSummary: 'q', outputSummary: 'http://x' }], notes: ['tavily_ok:t1'] },
            nextAction: { kind: 'continue' as const },
            trace: { agentName: 'executor' as const, durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'tavily-search' as const, toolResult: 'success' as const },
          };
        },
        responder: async () => ({
          data: { answer: '最终答', rawText: '', userPayload: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'responder', durationMs: 1, model: 'm', skipped: false },
        }),
        verify: async () => ({
          data: { answer: '最终答', rawText: '', fallback: false },
          nextAction: { kind: 'done', finalAnswer: '最终答' },
          trace: { agentName: 'verify', durationMs: 1, model: 'm', skipped: false },
        }),
      },
    });
    expect(result.terminalState).toBe('R_COMPLETED');
    expect(executorCalls).toBe(2);
  });

  it('returns R_FAILED on maxTurns exceeded', async () => {
    const tasks: PlanTask[] = [{ id: 't1', title: 'search', reason: 'r', needSearch: true }];
    const result = await runScheduler({
      runId: 'r4',
      sessionId: 's4',
      userMessage: 'q',
      maxTurns: 1,
      maxTasks: 4,
      taskMaxRetries: 0,
      runtimeTimeoutMs: 60000,
      router,
      adapters: {
        intent: async () => ({
          data: { needPlan: true, reason: 'r', directAnswer: '', rawText: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'intent', durationMs: 1, model: 'm', skipped: false },
        }),
        planner: async () => ({
          data: { tasks, rawText: '', answerDraft: '' },
          nextAction: { kind: 'continue' },
          trace: { agentName: 'planner', durationMs: 1, model: 'm', skipped: false },
        }),
        executor: async () => ({
          data: { steps: [{ taskId: 't1', title: 'search', status: 'failed' as const, tool: 'bailian-search' as const, inputSummary: 'q', outputSummary: 'always fail' }], notes: ['bailian_failed:t1:x'] },
          nextAction: { kind: 'retry_task' as const, taskId: 't1' },
          trace: { agentName: 'executor', durationMs: 10, model: 'n/a', skipped: false, toolUsed: 'bailian-search' as const, toolResult: 'fail' as const },
        }),
        responder: async () => { throw new Error('not reached'); },
        verify: async () => { throw new Error('not reached'); },
      },
    });
    expect(result.terminalState).toBe('R_FAILED');
    expect(result.terminalReason).toMatch(/max_turns/);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/scheduler.test.ts
```

预期：FAIL。

- [ ] **步骤 3：编写最少实现代码**

```typescript
// services/api/src/modules/advisor/runtime/scheduler.ts
import {
  applyRuntimeEvent,
  createRuntimeInitial,
  type RuntimeContext,
} from './runtime.state_machine';
import { applyTaskEvent, createTaskInitial, shouldRetry, type TaskContext } from './task.state_machine';
import type {
  AgentResult,
  ExecutorData,
  IntentData,
  PlannerData,
  ResponderData,
  VerifyData,
} from './agent_adapter.types';
import type { RouterPolicy } from './router_policy.types';
import type { AgentLoopEvent } from '../agent_loop/types';

export type SchedulerAdapters = {
  intent(): Promise<AgentResult<IntentData>>;
  planner(): Promise<AgentResult<PlannerData>>;
  executor(params: { tasks: TaskContext[] }): Promise<AgentResult<ExecutorData>>;
  responder(params: { tasks: TaskContext[]; executor: ExecutorData }): Promise<AgentResult<ResponderData>>;
  verify(params: { draft: string }): Promise<AgentResult<VerifyData>>;
};

export type SchedulerInput = {
  runId: string;
  sessionId: string;
  userMessage: string;
  maxTurns: number;
  maxTasks: number;
  taskMaxRetries: number;
  runtimeTimeoutMs: number;
  router: RouterPolicy;
  adapters: SchedulerAdapters;
  onEvent?: (event: AgentLoopEvent) => void;
};

export type SchedulerResult = {
  runtime: RuntimeContext;
  terminalState: RuntimeContext['state'];
  terminalReason?: string;
  finalAnswer: string;
  totalTurns: number;
  tasks: TaskContext[];
  events: AgentLoopEvent[];
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function runScheduler(input: SchedulerInput): Promise<SchedulerResult> {
  const events: AgentLoopEvent[] = [];
  const recordEvent = (e: Omit<AgentLoopEvent, 'runId' | 'timestamp'>) => {
    const event: AgentLoopEvent = { runId: input.runId, timestamp: nowIso(), ...e };
    events.push(event);
    input.onEvent?.(event);
  };

  let runtime = createRuntimeInitial({ runId: input.runId, sessionId: input.sessionId });
  runtime = applyRuntimeEvent(runtime, { kind: 'start' });
  recordEvent({ event: 'runtime_start', stage: 'loop', status: 'running' });

  const intentResult = await input.adapters.intent();
  if (intentResult.nextAction.kind === 'done') {
    runtime = applyRuntimeEvent(runtime, { kind: 'all_tasks_done' });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'completed', endState: 'completed' });
    return {
      runtime,
      terminalState: runtime.state,
      finalAnswer: intentResult.nextAction.finalAnswer,
      totalTurns: 0,
      tasks: [],
      events,
    };
  }
  if (intentResult.nextAction.kind === 'abort') {
    runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: intentResult.nextAction.reason });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: intentResult.nextAction.reason });
    return { runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: 0, tasks: [], events };
  }

  let tasks: TaskContext[] = [];
  let finalAnswer = '';
  for (let turn = 0; turn < input.maxTurns; turn++) {
    runtime.turnIndex = turn;
    recordEvent({ event: 'turn_start', stage: 'loop', status: 'running' });

    const plannerResult = await input.adapters.planner();
    if (plannerResult.nextAction.kind === 'abort') {
      runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: plannerResult.nextAction.reason });
      recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: plannerResult.nextAction.reason });
      return { runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: turn + 1, tasks, events };
    }
    const cappedPlanned = plannerResult.data.tasks.slice(0, input.maxTasks);
    tasks = cappedPlanned.map((t) =>
      createTaskInitial({ taskId: t.id, title: t.title, needSearch: t.needSearch, maxRetries: input.taskMaxRetries }),
    );

    let executorResult = await input.adapters.executor({ tasks });
    // record per-task events from executor output
    for (const step of executorResult.data.steps) {
      const idx = tasks.findIndex((t) => t.taskId === step.taskId);
      if (idx < 0) continue;
      tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'pick' });
      if (step.status === 'done' || step.status === 'skipped') {
        tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'success' });
        recordEvent({ event: 'task_done', stage: 'executor', status: 'completed', taskIndex: idx });
      } else {
        tasks[idx] = applyTaskEvent(tasks[idx], { kind: 'fail', reason: step.outputSummary.slice(0, 80) });
        recordEvent({ event: 'task_failed', stage: 'executor', status: 'failed', taskIndex: idx, failureReason: step.outputSummary.slice(0, 80) });
      }
    }
    input.router.recordSignal({
      toolResult:
        executorResult.data.steps.some((s) => s.status === 'failed') ? 'fail' :
        executorResult.data.steps.some((s) => s.status === 'done') ? 'success' : 'empty',
    });

    if (executorResult.nextAction.kind === 'retry_task') {
      let retried = false;
      tasks = tasks.map((t) => {
        if (t.taskId === executorResult.nextAction.kind && shouldRetry(t)) return t; // (type narrow workaround below)
        return t;
      });
      // 真正的重试逻辑：找到第一个 FAILED 且可重试的任务
      const failedIdx = tasks.findIndex((t) => t.state === 'T_FAILED' && shouldRetry(t));
      if (failedIdx >= 0) {
        tasks[failedIdx] = applyTaskEvent(tasks[failedIdx], { kind: 'retry' });
        recordEvent({ event: 'task_retried', stage: 'executor', status: 'running', taskIndex: failedIdx });
        retried = true;
      } else {
        // 把不能再重试的标为 SKIPPED
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].state === 'T_FAILED') {
            tasks[i] = applyTaskEvent(tasks[i], { kind: 'exceed_retries' });
            recordEvent({ event: 'task_skipped', stage: 'executor', status: 'failed', taskIndex: i });
          }
        }
      }
      recordEvent({ event: 'turn_complete', stage: 'loop', status: 'running' });
      if (retried) {
        continue; // 下一 turn
      }
    }

    // Responder
    const responderResult = await input.adapters.responder({ tasks, executor: executorResult.data });
    if (responderResult.nextAction.kind === 'abort') {
      runtime = applyRuntimeEvent(runtime, { kind: 'critical_fail', reason: responderResult.nextAction.reason });
      recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: responderResult.nextAction.reason });
      return { runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer: '', totalTurns: turn + 1, tasks, events };
    }
    finalAnswer = responderResult.data.answer;

    // Verify
    const verifyResult = await input.adapters.verify({ draft: responderResult.data.answer });
    input.router.recordSignal({ verifyOutcome: verifyResult.data.fallback ? 'fail' : 'pass' });
    if (verifyResult.nextAction.kind === 'done') {
      finalAnswer = verifyResult.nextAction.finalAnswer;
    }

    runtime = applyRuntimeEvent(runtime, { kind: 'all_tasks_done' });
    recordEvent({ event: 'turn_complete', stage: 'loop', status: 'completed' });
    recordEvent({ event: 'runtime_end', stage: 'loop', status: 'completed', endState: 'completed' });
    return { runtime, terminalState: runtime.state, finalAnswer, totalTurns: turn + 1, tasks, events };
  }

  // maxTurns exceeded
  runtime = applyRuntimeEvent(runtime, { kind: 'max_turns_exceeded' });
  recordEvent({ event: 'runtime_end', stage: 'loop', status: 'failed', endState: 'failed', failureReason: 'max_turns_exceeded' });
  return { runtime, terminalState: runtime.state, terminalReason: runtime.terminalReason, finalAnswer, totalTurns: input.maxTurns, tasks, events };
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/scheduler.test.ts
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add services/api/src/modules/advisor/runtime/scheduler.ts \
  services/api/test/advisor/runtime/scheduler.test.ts
git commit -m "feat(advisor/runtime): implement Scheduler with turn loop and task retry"
```

---

### 任务 10：Runtime 入口与 AdvisorService 集成

**文件：**
- 创建：`services/api/src/modules/advisor/runtime/runtime.entry.ts`
- 修改：`services/api/src/modules/advisor/advisor.service.ts`（仅在 `chat()` 入口加 RUNTIME_ENABLED 分流）

- [ ] **步骤 1：编写失败的测试**

`services/api/test/advisor/runtime/runtime_e2e.test.ts`：

```typescript
import request from 'supertest';
import { app } from '../../../src/index';

describe('Advisor /chat with ADVISOR_RUNTIME_ENABLED', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns the same shape when RUNTIME disabled (back-compat)', async () => {
    delete process.env.ADVISOR_RUNTIME_ENABLED;
    const res = await request(app)
      .post('/advisor/chat')
      .send({ userId: 'u1', message: '你好', allowSearch: false })
      .expect(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('meta.route');
    expect(res.body).toHaveProperty('trace.timings.totalMs');
  });

  it('returns the same shape when RUNTIME enabled (greeting fast path still works)', async () => {
    process.env.ADVISOR_RUNTIME_ENABLED = 'true';
    const res = await request(app)
      .post('/advisor/chat')
      .send({ userId: 'u1', message: '你好', allowSearch: false })
      .expect(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('meta.route');
    expect(res.body).toHaveProperty('trace.timings.totalMs');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd services/api && pnpm test test/advisor/runtime/runtime_e2e.test.ts
```

预期：FAIL（runtime 入口尚不存在；启用开关后会落到未实现路径）。

- [ ] **步骤 3：编写 Runtime 入口**

```typescript
// services/api/src/modules/advisor/runtime/runtime.entry.ts
import { runIntentGate } from '../agent_loop/intent.agent';
import { runPlanner } from '../agent_loop/planner.agent';
import { runExecutor } from '../agent_loop/executor.agent';
import { runResponder } from '../agent_loop/responder.agent';
import { runVerify } from '../agent_loop/verify.agent';
import { adaptIntent, adaptPlanner, adaptExecutor, adaptResponder, adaptVerify } from './agent_adapter';
import { createMemoryRouterPolicy } from './router_policy.memory';
import { runScheduler, type SchedulerResult } from './scheduler';
import { readRuntimeEnv } from './env';
import { classifyKeywords } from './keyword_categories';
import { randomUUID } from 'node:crypto';
import type { PlanTask } from '../agent_loop/types';

export type RuntimeEntryInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  intentModel: string;
  plannerModel: string;
  responderModel: string;
  verifyModel: string;
  userMessage: string;
  weeklyTrend: string;
  effectiveAllowSearch: boolean;
  enableThinking: boolean;
  searchToolTimeoutMs: number;
  sessionId?: string;
};

export type RuntimeEntryOutput = SchedulerResult & {
  intentDurationMs: number;
  plannerDurationMs: number;
  executorDurationMs: number;
  responderDurationMs: number;
  verifyDurationMs: number;
  verifyEnabled: boolean;
};

export async function runAdvisorRuntime(input: RuntimeEntryInput): Promise<RuntimeEntryOutput> {
  const env = readRuntimeEnv();
  const router = createMemoryRouterPolicy({
    enabled: env.routerDEnabled,
    mode: env.routerDMode,
    windowMs: env.rollingWindowMs,
  });

  let intentDurationMs = 0;
  let plannerDurationMs = 0;
  let executorDurationMs = 0;
  let responderDurationMs = 0;
  let verifyDurationMs = 0;
  let plannedTasks: PlanTask[] = [];
  let lastExecutorOutput = { steps: [] as any[], notes: [] as string[] };

  // Verify 启停沿用现有环境变量（最高优先级，作为 human override）
  const verifyEnabled = process.env.ADVISOR_ENABLE_VERIFY?.trim().toLowerCase() !== 'false';

  const result = await runScheduler({
    runId: randomUUID(),
    sessionId: input.sessionId ?? randomUUID(),
    userMessage: input.userMessage,
    maxTurns: env.maxTurns,
    maxTasks: env.maxTasks,
    taskMaxRetries: env.taskMaxRetries,
    runtimeTimeoutMs: env.runtimeTimeoutMs,
    router,
    adapters: {
      async intent() {
        const start = Date.now();
        const raw = await runIntentGate({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.intentModel,
          userMessage: input.userMessage,
          weeklyTrend: input.weeklyTrend,
          enableThinking: input.enableThinking,
        });
        intentDurationMs = Date.now() - start;
        return adaptIntent(raw, { durationMs: intentDurationMs, model: input.intentModel });
      },
      async planner() {
        const start = Date.now();
        const raw = await runPlanner({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.plannerModel,
          userMessage: input.userMessage,
          weeklyTrend: input.weeklyTrend,
          enableThinking: input.enableThinking,
        });
        plannerDurationMs = Date.now() - start;
        plannedTasks = raw.tasks;
        return adaptPlanner(raw, { durationMs: plannerDurationMs, model: input.plannerModel });
      },
      async executor() {
        const start = Date.now();
        // D 决定的超时（三级降级链）
        const timeoutDecision = router.decide({
          decisionPoint: 'setSearchTimeout',
          signal: {
            messageLengthBucket: input.userMessage.length < 20 ? 'short' : input.userMessage.length < 100 ? 'medium' : 'long',
            keywordCategory: classifyKeywords(input.userMessage),
            recentToolFailureRate: router.getStats().toolTotalCount > 0 ? router.getStats().toolFailureCount / router.getStats().toolTotalCount : 0,
            recentVerifyFailRate: router.getStats().verifyTotalCount > 0 ? router.getStats().verifyFailCount / router.getStats().verifyTotalCount : 0,
          },
          defaults: { value: input.searchToolTimeoutMs },
        });
        const raw = await runExecutor({
          tasks: plannedTasks,
          allowSearch: input.effectiveAllowSearch,
          dashscopeApiKey: process.env.DASHSCOPE_API_KEY?.trim(),
          dashscopeCompatBaseUrl: process.env.DASHSCOPE_COMPAT_BASE_URL?.trim(),
          dashscopeModel: process.env.DASHSCOPE_MODEL?.trim(),
          xBearerToken: process.env.X_BEARER_TOKEN?.trim(),
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.userMessage,
          searchToolTimeoutMs: timeoutDecision.value,
        });
        executorDurationMs = Date.now() - start;
        lastExecutorOutput = raw;
        return adaptExecutor({ steps: raw.steps, notes: raw.notes }, { durationMs: executorDurationMs, model: 'n/a' });
      },
      async responder() {
        const start = Date.now();
        const raw = await runResponder({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.responderModel,
          userMessage: input.userMessage,
          tasks: plannedTasks,
          executorSteps: lastExecutorOutput.steps,
          executorNotes: lastExecutorOutput.notes,
          enableThinking: input.enableThinking,
        });
        responderDurationMs = Date.now() - start;
        return adaptResponder(raw, { durationMs: responderDurationMs, model: input.responderModel });
      },
      async verify({ draft }) {
        if (!verifyEnabled) {
          return adaptVerify({ answer: draft, rawText: '', fallback: true }, { durationMs: 0, model: input.verifyModel });
        }
        const start = Date.now();
        try {
          const raw = await runVerify({
            baseUrl: input.baseUrl,
            apiKey: input.apiKey,
            model: input.verifyModel,
            userMessage: input.userMessage,
            draftAnswer: draft,
            enableThinking: input.enableThinking,
          });
          verifyDurationMs = Date.now() - start;
          return adaptVerify({ answer: raw.answer, rawText: raw.rawText, fallback: false }, { durationMs: verifyDurationMs, model: input.verifyModel });
        } catch (err) {
          verifyDurationMs = Date.now() - start;
          return adaptVerify({ answer: draft, rawText: '', fallback: true }, { durationMs: verifyDurationMs, model: input.verifyModel });
        }
      },
    },
  });

  return {
    ...result,
    intentDurationMs,
    plannerDurationMs,
    executorDurationMs,
    responderDurationMs,
    verifyDurationMs,
    verifyEnabled,
  };
}
```

- [ ] **步骤 4：修改 AdvisorService.chat 加分流**

在 `services/api/src/modules/advisor/advisor.service.ts` 的 `chat()` 方法**开头**（greeting fast path 之后、dashKey 检查之前）增加：

```typescript
// E.1 分流：RUNTIME 启用且有 dashKey 时走新 runtime
const runtimeEnabledFlag = process.env.ADVISOR_RUNTIME_ENABLED?.trim().toLowerCase() === 'true';
const dashKeyForRuntime = process.env.DASHSCOPE_API_KEY?.trim();
if (runtimeEnabledFlag && dashKeyForRuntime) {
  const { runAdvisorRuntime } = await import('./runtime/runtime.entry');
  const baseUrl = process.env.DASHSCOPE_COMPAT_BASE_URL?.trim() || defaultDashscopeBaseUrl;
  const model = process.env.DASHSCOPE_MODEL?.trim() || 'qwen3.5-flash';
  const intentModel = process.env.ADVISOR_INTENT_MODEL?.trim() || model;
  const plannerModel = process.env.ADVISOR_PLANNER_MODEL?.trim() || model;
  const responderModel = process.env.ADVISOR_RESPONDER_MODEL?.trim() || model;
  const verifyModel = process.env.ADVISOR_VERIFY_MODEL?.trim() || model;
  const enableThinking = parseEnableThinking(process.env.ADVISOR_ENABLE_THINKING);
  const searchToolTimeoutMs = parseSearchToolTimeoutMs(process.env.ADVISOR_SEARCH_TOOL_TIMEOUT_MS);
  try {
    const runtimeOutput = await runAdvisorRuntime({
      baseUrl, apiKey: dashKeyForRuntime, model, intentModel, plannerModel, responderModel, verifyModel,
      userMessage: input.message,
      weeklyTrend: trend,
      effectiveAllowSearch,
      enableThinking,
      searchToolTimeoutMs,
    });
    // 适配为现有 ChatOutput 结构
    const totalMs = runtimeOutput.runtime.endedAtMs! - runtimeOutput.runtime.startedAtMs!;
    return {
      answer: runtimeOutput.finalAnswer,
      citations: [...citations, 'provider:bailian-qwen-compatible', 'runtime:e1'],
      meta: { model, route: 'dashscope', llmOk: runtimeOutput.terminalState === 'R_COMPLETED' },
      trace: {
        intentPromptFile,
        intent: { needPlan: runtimeOutput.totalTurns > 0, reason: 'runtime-e1' },
        plannerPromptFile,
        toolRegistryFile,
        tasks: [],
        executorSteps: [],
        webLinks: [],
        timings: {
          totalMs,
          intent: buildStageTiming({ durationMs: runtimeOutput.intentDurationMs, model: intentModel }),
          planner: buildStageTiming({ durationMs: runtimeOutput.plannerDurationMs, model: plannerModel }),
          executor: buildStageTiming({ durationMs: runtimeOutput.executorDurationMs, model: 'n/a' }),
          responder: buildStageTiming({ durationMs: runtimeOutput.responderDurationMs, model: responderModel }),
          verify: buildStageTiming({
            durationMs: runtimeOutput.verifyDurationMs,
            model: verifyModel,
            skipped: !runtimeOutput.verifyEnabled,
            reason: !runtimeOutput.verifyEnabled ? 'verify-disabled-by-env' : undefined,
          }),
        },
      },
    };
  } catch (err) {
    console.warn('[advisor][runtime_e1_fallback]', err instanceof Error ? err.message : String(err));
    // 失败时降级到原 pipeline，继续走 dashKey 路径
  }
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd services/api && pnpm test test/advisor/runtime/runtime_e2e.test.ts
cd services/api && pnpm test  # 全量回归
```

预期：所有 PASS（包括现有 suites 零回归）。

- [ ] **步骤 6：Commit**

```bash
git add services/api/src/modules/advisor/runtime/runtime.entry.ts \
  services/api/src/modules/advisor/advisor.service.ts \
  services/api/test/advisor/runtime/runtime_e2e.test.ts
git commit -m "feat(advisor/runtime): integrate runtime entry into AdvisorService with feature flag"
```

---

### 任务 11：环境变量文档与 .env.example 更新

**文件：**
- 修改：`services/api/.env.example`

- [ ] **步骤 1：追加新增环境变量说明**

在 `services/api/.env.example` 末尾追加：

```bash

# === E.1: Self-Evolving Runtime（默认关闭，回退到原 pipeline）===
ADVISOR_RUNTIME_ENABLED=false        # true 启用 L1 in-process loop
ADVISOR_MAX_TURNS=3                  # 单次请求内的最大 turn 数（1-10）
ADVISOR_MAX_TASKS=4                  # 单次请求内 planner 任务数上限（1-8）
ADVISOR_TASK_MAX_RETRIES=1           # 单个 task 失败后重试次数（0-3）
ADVISOR_RUNTIME_TIMEOUT_MS=60000     # Runtime 整体超时（5000-300000）

# === E.1: D RouterPolicy（默认关闭，启用需 ADVISOR_RUNTIME_ENABLED=true）===
ADVISOR_ROUTER_D_ENABLED=false       # true 启用 D 自适应路由（内存版）
ADVISOR_ROUTER_D_MODE=rolling_stats_only  # rolling_stats_only | with_policy_table（E.2 之后启用）
ADVISOR_ROLLING_WINDOW_MS=300000     # D 滚动统计窗口（30000-1800000）
```

- [ ] **步骤 2：Commit**

```bash
git add services/api/.env.example
git commit -m "docs(advisor): add ADVISOR_RUNTIME_* env vars to .env.example for E.1"
```

---

### 任务 12：性能基线对比 + 闸门验证

**文件：**
- 创建：`services/api/scripts/perf_baseline_e1.ts`（一次性脚本，不入主 build）
- 不需要持久测试文件

- [ ] **步骤 1：编写性能对比脚本**

```typescript
// services/api/scripts/perf_baseline_e1.ts
import { performance } from 'node:perf_hooks';
import { AdvisorService } from '../src/modules/advisor/advisor.service';

const messages = [
  '你好',
  '帮我把今天的任务拆成可执行的下一步',
  '宝可梦新作发售时间',
  '最新天气如何',
];

async function run(label: string, iterations = 5): Promise<void> {
  const svc = new AdvisorService();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    for (const m of messages) {
      const start = performance.now();
      try {
        await svc.chat({ userId: 'perf', message: m, allowSearch: true });
      } catch (_) { /* ignore for perf */ }
      samples.push(performance.now() - start);
    }
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  console.log(`[perf:${label}] samples=${samples.length} p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms`);
}

async function main(): Promise<void> {
  console.log('Baseline (RUNTIME disabled):');
  delete process.env.ADVISOR_RUNTIME_ENABLED;
  await run('baseline');
  console.log('\nE.1 (RUNTIME enabled):');
  process.env.ADVISOR_RUNTIME_ENABLED = 'true';
  await run('e1');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **步骤 2：运行性能对比（需配置 DASHSCOPE_API_KEY）**

```bash
cd services/api && pnpm exec tsx scripts/perf_baseline_e1.ts
```

预期输出形如：
```
Baseline (RUNTIME disabled):
[perf:baseline] samples=20 p50=1200ms p95=3500ms

E.1 (RUNTIME enabled):
[perf:e1] samples=20 p50=1320ms p95=3850ms
```

**Go/No-Go 判定：** `e1.p50 / baseline.p50 <= 1.10` 且 `e1.p95 / baseline.p95 <= 1.20`，否则 No-Go，回滚。

- [ ] **步骤 3：执行降级演练**

```bash
# 1. 关闭 runtime，跑现有 suites
unset ADVISOR_RUNTIME_ENABLED && cd services/api && pnpm test

# 2. 开启 runtime + 关闭 D，跑现有 suites
ADVISOR_RUNTIME_ENABLED=true ADVISOR_ROUTER_D_ENABLED=false cd services/api && pnpm test

# 3. 开启 runtime + 开启 D，跑现有 suites
ADVISOR_RUNTIME_ENABLED=true ADVISOR_ROUTER_D_ENABLED=true cd services/api && pnpm test
```

预期：三种组合下所有现有测试均 PASS（零回归）。

- [ ] **步骤 4：Commit**

```bash
git add services/api/scripts/perf_baseline_e1.ts
git commit -m "chore(advisor/runtime): add perf baseline script for E.1 gate validation"
```

---

### 任务 13：progress.md 更新与 Phase E.1 收尾

**文件：**
- 修改：`progress.md`

- [ ] **步骤 1：追加进展记录**

在 `progress.md` 进展记录顶部插入一条新条目（保持时间倒序）：

```md
### [YYYY-MM-DD HH:mm] [窗口: <id/名称>] [任务: Task 17 - Phase E.1 落地]
- 操作: 完成 self-evolving advisor Phase E.1 全部 12 个子任务（状态机/Scheduler/agent wrapper/RouterPolicy 内存版/runtime 入口/ADVISOR_RUNTIME_* env 集成/性能闸门），三级降级链可演练。
- 文件: `services/api/src/modules/advisor/runtime/**`, `services/api/test/advisor/runtime/**`, `services/api/src/modules/advisor/advisor.service.ts`, `services/api/.env.example`, `services/api/scripts/perf_baseline_e1.ts`, `progress.md`
- 验证: `cd services/api && pnpm test` PASS（所有现有 suites + 新增 7 个 runtime suites）；降级演练三种组合（disable/enable+D-off/enable+D-on）均 PASS；perf 闸门 e1.p50 / baseline.p50 ≤ 1.10 通过。
- 决策: 保留 D 默认关闭（ADVISOR_ROUTER_D_ENABLED=false），先在内网环境验证 1 周再考虑灰度开启。
- 下一步: 进入 Phase E.2（L2 SessionStore + D-Learner 离线版 + V3/V5/V6 加入 + mobile explicit 信号 UI 通道）。
```

- [ ] **步骤 2：更新 Task 状态看板**

```md
| Task 17 | Self-evolving advisor agent 架构（L1+L2+L3 + D 自适应路由） | DONE-E1 / IN_PROGRESS-E2 | 当前会话 | YYYY-MM-DD HH:mm | Phase E.1 已落地并通过闸门，下一步进 E.2 |
```

- [ ] **步骤 3：Commit**

```bash
git add progress.md
git commit -m "docs(progress): record Phase E.1 completion of self-evolving advisor runtime"
```

---

## 自检（按 writing-plans skill §「自检」）

### 1. 规格覆盖度

| spec §4 / §6 / §11.1 章节 | 任务对应 | 状态 |
|---|---|---|
| §4.1 Runtime 状态机 | 任务 1 + 任务 2 | ✓ |
| §4.2 Task 状态机 | 任务 1 + 任务 3 | ✓ |
| §4.3 Scheduler 职责 | 任务 9 | ✓ |
| §4.4 5 个 agent wrapper | 任务 4 + 任务 5 | ✓ |
| §4.5 错误分类 | 任务 2（terminalReason）+ 任务 9（critical_fail/max_turns） | ✓ |
| §6.1-6.3 D 信号采集 + 决策点 + 在线滚动统计 | 任务 8 | ✓ |
| §6.4 关键词分类归属 | 任务 7 | ✓ |
| §6.7 三级降级链 | 任务 8 + 任务 10（verifyEnabled 作为 human override 示例） | ✓ |
| §6.9 V1+V4+V8 在 E.1 释放 | 任务 8（V1 routeIntent、V4 setSearchTimeout、V8 setMaxTurns） | ✓ |
| §10.1 ADVISOR_RUNTIME_* 环境变量 | 任务 6 + 任务 11 | ✓ |
| §9.4 E.1 闸门 | 任务 12 | ✓ |
| §11.1 交付物清单 | 全部 12 任务 | ✓ |

**未覆盖项：** 无。

### 2. 占位符扫描

- 无 "TBD" / "TODO" / "后续实现"
- 所有代码块均完整可执行
- 所有命令均给出预期输出

### 3. 类型一致性

- `RuntimeState` / `TaskState` 枚举值在所有 task 中保持一致（R_/T_ 前缀）
- `AgentResult.nextAction.kind` 在 adapter（任务 5）与 scheduler（任务 9）中签名一致
- `RouterDecision.source` 在 router_policy.types（任务 8）与 scheduler（任务 9）中一致
- `RuntimeEnv` 字段名在 env.ts（任务 6）与 runtime.entry.ts（任务 10）中一致

无类型漂移。

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-23-self-evolving-advisor-e1-plan.md`。两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代
- 必需子技能：`superpowers:subagent-driven-development`

**2. 内联执行** — 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点
- 必需子技能：`superpowers:executing-plans`

后续 plan：
- E.2 plan：`docs/superpowers/plans/2026-05-23-self-evolving-advisor-e2-plan.md`（紧随其后产出）
- E.3 plan：`docs/superpowers/plans/2026-05-23-self-evolving-advisor-e3-plan.md`（紧随其后产出）
