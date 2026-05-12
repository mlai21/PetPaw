# 阿里云百炼 · OpenAI 兼容 Chat Completions 接入规范

本文档约定 **PetPaw** 仓库内如何通过阿里云百炼（灵积 DashScope）的 **OpenAI 兼容模式** 调用通义千问模型，并与 `services/api` 顾问模块对齐。权威说明以阿里云官方文档为准。

## 1. 官方参考

- **通过 OpenAI 兼容接口调用通义千问**：  
  https://www.alibabacloud.com/help/zh/model-studio/qwen-api-via-openai-chat-completions  
- **获取 API Key**：  
  https://www.alibabacloud.com/help/zh/model-studio/get-api-key  
- **通过环境变量配置 API Key**：  
  https://www.alibabacloud.com/help/zh/model-studio/configure-api-key-through-environment-variables  
- **模型列表与命名**：  
  https://www.alibabacloud.com/help/zh/model-studio/getting-started/models  

若官方文档与本文档冲突，**以官方为准**，并应同步修订本节链接与下述「地域 / URL」表。

## 2. 与本项目的集成方式

| 项目 | 约定 |
|------|------|
| 服务端入口 | `services/api` 中 `POST /advisor/chat` → `AdvisorService.chat` |
| 优先提供商 | 若设置 `DASHSCOPE_API_KEY`，则使用百炼 **OpenAI 兼容** Chat Completions |
| HTTP 形态 | `POST {baseUrl}/chat/completions`，请求体为 OpenAI 风格的 `model` + `messages`（含 `system` / `user`） |
| 鉴权头 | `Authorization: Bearer <DASHSCOPE_API_KEY>`，`Content-Type: application/json` |
| 默认模型（初期） | `qwen3.5-flash`，可通过 `DASHSCOPE_MODEL` 覆盖 |
| 响应解析 | 读取 `choices[0].message.content` 作为顾问回复正文 |
| 无密钥或未配置 | 不发起外网请求，返回占位文案（保证单测与 CI 稳定） |

实现代码：

- 通用请求：`services/api/src/modules/advisor/chat_completions.ts`（`completeChatCompletions`）
- 路由与提供商选择：`services/api/src/modules/advisor/advisor.service.ts`

## 3. 环境变量

在 `services/api` 目录维护本地 `.env`（**勿提交**；仓库仅保留 `.env.example`）。

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DASHSCOPE_API_KEY` | 接入百炼时 **是** | 百炼 / DashScope API Key（形如 `sk-...`，以控制台为准） |
| `DASHSCOPE_COMPAT_BASE_URL` | 否 | OpenAI 兼容 **`base_url`**（**不含** `/chat/completions`）。未设置时使用下表「默认（中国大陆）」 |
| `DASHSCOPE_MODEL` | 否 | 默认 `qwen3.5-flash` |

**可选后备（非百炼）**：若未设置 `DASHSCOPE_API_KEY` 且设置了 `OPENAI_API_KEY`，则使用 `OPENAI_BASE_URL`（默认 `https://api.openai.com/v1`）与 `OPENAI_MODEL` 走同一套 `completeChatCompletions` 逻辑。生产环境建议二选一，避免混用两套计费。

## 4. 地域与 `base_url`（摘自官方兼容模式说明）

官方强调：**不同地域的 API Key 不同**，须与所选 `base_url` 一致。

| 场景 | SDK / 兼容模式 `base_url`（示例） | Chat Completions 完整路径 |
|------|-------------------------------------|---------------------------|
| 国际（新加坡等，示例） | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `.../v1/chat/completions` |
| 美国（弗吉尼亚） | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` | 同上 |
| **中国大陆（北京）**（本项目默认） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 同上 |
| 中国（香港） | `https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1` | 同上 |

本项目代码默认 **`https://dashscope.aliyuncs.com/compatible-mode/v1`**，适用于北京地域 Key。若 Key 属于新加坡/弗吉尼亚等，**必须**设置 `DASHSCOPE_COMPAT_BASE_URL` 为对应地域的 `compatible-mode/v1` 前缀。

## 5. 请求与响应（与 OpenAI Chat Completions 对齐部分）

- **请求**：`model`、`messages`（本项目使用 `system` + `user`）、`temperature` 等字段遵循官方「OpenAI 兼容」章节；百炼专有参数（如部分模型下的 `top_k`、`extra_body`）需按官方说明扩展，当前仓库未默认附带。
- **响应**：解析 `choices[0].message.content`；错误时服务端捕获后回退占位回答，并在 `citations` 中追加 `bailian-error:...` 便于排查（**勿**在对外接口中暴露完整密钥或原始堆栈）。

## 6. 流式输出

官方支持 `stream: true` 的 SSE 分块响应。当前 `services/api` 为 **非流式** 单次 JSON，与移动端现有「模拟流式」体验分离；若需真流式，应单独开 spec（SSE/WebSocket、超时与中断、与 `AdvisorChatPage` 状态机对接）。

## 7. 安全与合规

- `.env` 已列入仓库根目录 `.gitignore`，禁止将 `DASHSCOPE_API_KEY` 写入代码或提交 PR。
- CI / Jest 在 `jest.setup.js` 中清除 `DASHSCOPE_API_KEY` 与 `OPENAI_API_KEY`，确保自动化测试 **不访问外网大模型**。
- 生产部署使用密钥托管（如 KMS / 平台环境变量），并限制出口 IP 与配额告警（按阿里云控制台能力配置）。

## 8. 验收清单（开发自测）

1. 在 `services/api/.env` 配置 `DASHSCOPE_API_KEY` 与（如需要）`DASHSCOPE_COMPAT_BASE_URL`。  
2. 启动 API 进程，`NODE_ENV` 非 `test`，确保 `dotenv` 已加载（见 `src/index.ts`）。  
3. `POST /advisor/chat`，请求体含 `userId`、`message`、`allowSearch`，响应 `answer` 为模型生成内容，`citations` 含 `provider:bailian-qwen-compatible`。  
4. 未配置密钥时，响应仍为占位 `answer`，且不发起外网请求。  
5. `cd services/api && pnpm test` 全部通过。

---

**文档维护**：百炼接口或模型名变更时，请更新第 1 节链接、第 4 节地域表及第 2 节默认模型行，并视情况调整 `advisor.service.ts` 中的默认值。
