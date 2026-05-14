# 搜索工具 API 接入规范（X / Tavily / 百炼）

## 0. 官方参考链接

- X Recent Search Quickstart: <https://docs.x.com/x-api/posts/search/quickstart/recent-search>
- X Build Query: <https://docs.x.com/x-api/posts/search/integrate/build-a-query>
- Tavily Search API: <https://docs.tavily.com/documentation/api-reference/endpoint/search>
- 百炼联网检索 Agent API 参考: <https://help.aliyun.com/zh/model-studio/web-search-agent-api-reference/>
- 百炼联网搜索能力说明: <https://help.aliyun.com/zh/model-studio/web-search>

## 1. 目标

本规范用于约束 Advisor 后端的搜索工具接入方式，确保：

- 调用协议统一、可观测
- 响应字段可被 Executor 归一化
- `content` 可稳定传入最终汇总模型（Responder）与校验模型（Verify）

## 2. 统一工具接口约定

每个搜索工具必须输出统一结构：

```ts
type SearchToolResult = {
  source: 'x-search' | 'tavily-search' | 'bailian-search';
  title: string;
  url: string;
  content: string; // 供模型阅读的核心字段
  rawMeta?: Record<string, unknown>;
};
```

约束：

- `content` 必须有值；无可用正文时返回空字符串 `''`，不得省略字段
- 所有工具返回结果都要带 `source`
- `content` 单条建议截断到 1200-2000 字符，避免 prompt 过大

## 3. X API v2 接入规范（官方）

### 3.1 鉴权与端点

- 鉴权：`Authorization: Bearer <X_BEARER_TOKEN>`
- 端点：`GET https://api.x.com/2/tweets/search/recent`

### 3.2 推荐请求参数

- `query`: 必填，支持 operator（如 `lang:zh -is:retweet`）
- `max_results`: 10~100（建议 10-30）
- `tweet.fields`: `created_at,author_id,lang,public_metrics`
- `expansions`: `author_id`
- `user.fields`: `name,username`

### 3.3 归一化映射

- `title`: 取 `Tweet by @username`
- `url`: `https://x.com/<username>/status/<id>`
- `content`: Tweet `text`
- `rawMeta`: `created_at/public_metrics/lang`

## 4. Tavily API 接入规范

### 4.1 鉴权与端点

- 端点：`POST https://api.tavily.com/search`
- 鉴权：请求体 `api_key`

### 4.2 推荐请求参数

- `query`: 用户问题或任务子查询
- `max_results`: 3~5
- `search_depth`: `basic`（默认）
- `include_answer`: `true`（可选）
- `include_raw_content`: `false`（默认，除非需要长文）

### 4.3 归一化映射

- `title`: `results[i].title`
- `url`: `results[i].url`
- `content`: `results[i].content`
- `rawMeta`: 可放 `score/published_date`

## 5. 阿里云百炼搜索接入规范

### 5.1 接入方式

- 若使用 OpenAI 兼容模式，模型响应读取 `choices[0].message.content`
- 若使用联网/工具模式，可能返回结构化 `content`（字符串或数组对象），必须先归一化为字符串

### 5.2 归一化原则

- 数组内容按段拼接，保留来源序号
- 清洗 markdown 噪音与无意义模板文本
- 归一化后映射到 `SearchToolResult.content`

## 6. Executor 到模型输入的传输规范

Executor 输出：

```ts
type ExecutionStep = {
  taskId: string;
  status: 'done' | 'failed' | 'skipped';
  tool: 'x-search' | 'tavily-search' | 'bailian-search' | 'none';
  inputSummary: string;
  outputSummary: string;
};
```

Responder 输入必须包含：

1. 原始用户问题
2. Planner 任务列表
3. Executor 所有步骤（尤其是 `outputSummary/content`）
4. Executor 备注（失败原因、跳过原因）

## 6.1 当前工程实现（已落地）

- `services/api/src/modules/advisor/agent_loop/bailian.tool.ts`
- `services/api/src/modules/advisor/agent_loop/x.tool.ts`
- `services/api/src/modules/advisor/agent_loop/tavily.tool.ts`
- `services/api/src/modules/advisor/agent_loop/executor.agent.ts`

当前回退顺序：

1. `bailian-search`（`DASHSCOPE_API_KEY`）
2. `x-search`（`X_BEARER_TOKEN`）
3. `tavily-search`（`TAVILY_API_KEY`）

若三者都不可用，Executor 产出 `skipped` 并附带原因，不中断整体回答链路。

## 7. 日志规范（当前实现约束）

按当前需求，生产日志只打印两类：

1. `final_summary_input`  
   - 必须能看见 executor 结果是否被喂入模型
2. `verify_output`  
   - 记录 verify 最终输出
   - verify 失败时记录 `fallback=true` 与 `reason`

## 8. 验收标准

满足以下条件视为接入成功：

1. 至少一个搜索工具返回了非空 `content`
2. `final_summary_input` 日志包含该 `content` 片段（可截断）
3. 最终接口 `answer` 来自 verify（或 verify 失败时回退 responder）
4. 测试包含：
   - 正常链路
   - verify 失败回退链路
   - 无 key / 无结果兜底链路
