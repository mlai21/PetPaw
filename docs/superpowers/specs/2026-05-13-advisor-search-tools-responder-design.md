# Advisor 搜索工具与 Responder 二次生成设计

## 背景与目标

当前 `AdvisorService` 链路为 `Planner -> Executor -> 返回 planner.answerDraft`。  
虽有 Tavily 执行步骤，但工具结果仅进入 `trace`，未真正回灌给模型生成最终回答。

本次目标：

1. 按市场通用规范实现搜索工具能力（X / Tavily / 阿里云百炼）。
2. 实现 `Executor` 结果到对应工具结果的可追踪映射。
3. 后端日志完整打印：
   - 工具执行结果
   - planner 输出
   - executor 输出
   - executor 输出与工具调用结果的映射输出
4. 修改后端逻辑：将返回 `content` 的搜索 API 结果喂给大模型阅读，最终由模型基于用户问题回答。

## 外部规范基线（用于实现约束）

### X API v2（官方）

- 使用 Bearer Token 鉴权（`Authorization: Bearer <token>`）。
- `recent search` 支持 `max_results`（上限 100）与 `next_token` 分页。
- 查询语法使用官方 operator（如 `lang:zh -is:retweet`）。
- 统一保留 `text`、`id`、`author_id`、`created_at`、`url`（可拼装）。

### Tavily Search API

- 关键参数：`query`、`max_results`、`include_answer`、`include_raw_content`。
- `results[].content` 是主要可读字段，需做长度控制和空值兜底。
- 建议控制 `max_results` 与 `include_raw_content`，避免上下文过大。

### 阿里云百炼（Model Studio / OpenAI 兼容与联网能力）

- 百炼对话结果中核心可读字段位于 `choices[].message.content`（兼容模式）。
- 联网搜索/工具调用模式下，`content` 可能为字符串或对象数组，需做归一化。
- 本方案选择“百炼搜索主通道”，并统一输出到工具标准结构。

## 目标架构（已确认：方案 C）

`Planner -> Executor(百炼主通道 + 回退) -> Responder -> API 输出`

- `Planner`：只负责任务拆解；`answerDraft` 保留为兜底，不作为主回答。
- `Executor`：按任务执行搜索，并统一收集工具 `content`。
- `Responder`：新增长回答生成步骤，读取用户问题 + planner 任务 + executor 搜索内容，生成最终回复。

## 组件与接口设计

### 1) Tool 标准输出结构

新增统一类型（示意）：

- `SearchToolResult`
  - `source`: `'bailian-search' | 'x-search' | 'tavily-search'`
  - `title`: string
  - `url`: string
  - `content`: string
  - `rawMeta`: Record<string, unknown>

说明：`content` 为 responder 阅读主字段，任何工具都必须输出；缺失时输出空字符串并记录状态。

### 2) Executor 执行策略（方案 C）

- 主通道：`bailian-search`
- 回退 1：`x-search`（官方 v2）
- 回退 2：`tavily-search`

按任务处理逻辑：

1. `needSearch=false`：直接记 step done（tool=none）。
2. `needSearch=true`：执行主通道；失败则进入回退链。
3. 成功后写入：
   - `step.outputSummary`
   - `step.toolCallId`（新增）
   - `step.resultRef[]`（新增，指向 `SearchToolResult`）

### 3) Responder（新增）

新增 `runResponder(...)`，输入：

- `userMessage`
- `plannerTasks`
- `executorReadableContext`（由工具 `content` 构成）

输出：

- `finalAnswer`
- `rawText`（用于日志）

回退：

- responder 失败时，使用 `planner.answerDraft`；
- 若无有效检索内容，responder 仍输出回答，但必须声明外部信息不足。

## 数据流与 content 回灌规则

1. Planner 产出 `tasks`。
2. Executor 依据任务调用搜索工具，归一化成 `SearchToolResult[]`。
3. 构建 `executorReadableContext`（仅纳入搜索工具 content）。
4. Responder 使用：
   - 用户问题
   - 任务计划
   - 搜索 `content` 上下文
   生成最终答案。
5. API 返回 `answer` 改为 responder 结果（失败才回退 planner 草稿）。

## 日志规范（必须落地）

统一结构化日志（JSON string）：

1. `planner` 日志
   - `planner.rawText`
   - `planner.tasks`
2. `executor` 总日志
   - `executor.steps`
   - `executor.notes`
3. `tool` 调用日志
   - 调用前：`toolName taskId input`
   - 调用后：`toolName taskId outputSummary resultCount`
   - 失败：`toolName taskId error`
4. 映射日志（核心需求）
   - `executor_step_tool_map`：每个 step 对应的工具调用结果（含 content 是否存在）
5. responder 日志
   - `responder.inputPreview`（截断）
   - `responder.outputPreview`（截断）

## API 兼容性

- 保持 `POST /advisor/chat` 返回结构兼容：
  - `answer`
  - `citations`
  - `meta`
  - `trace`
- `trace` 扩展字段（向后兼容新增）：
  - `toolResults`（可选）
  - `responderRawText`（可选）
  - `executorStepToolMap`（可选）

## 错误处理

- 工具调用失败不直接中断整体流程，遵循回退链。
- 若所有搜索均失败：记录错误并继续 responder（使用已有上下文与安全提示）。
- 任何未捕获异常落回现有 stub / draft 逻辑，保证接口可用。

## 测试策略

1. 单测：tool 归一化函数（含 content 缺失、超长、异常数据）。
2. 单测：executor 回退链（主通道失败时正确切换）。
3. 单测：responder 输入构造（确保包含 content）。
4. 集成：`/advisor/chat` 在有搜索结果时，回答不再直接等于 `answerDraft`。
5. 集成：日志关键字段存在（planner/executor/tool/mapping/responder）。

## 范围与非目标

本次范围：

- 后端 Advisor 模块内搜索工具与回答链路改造。
- 日志可观测性增强。

非目标：

- 前端 UI 改造。
- 长期持久化检索缓存系统。
- 非搜索类工具的 content 回灌（后续可扩展白名单）。
