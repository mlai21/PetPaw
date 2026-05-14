# Advisor Verify Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Planner 与 Executor 后新增 Responder + Verify 双阶段生成，确保 executor 结果喂给最终模型，并输出 verify 优化后的答案给前端。

**Architecture:** 保留 `Planner -> Executor`，新增 `Responder` 负责“读取 executor 结果并生成首轮答案”，再由 `Verify` 对首轮答案做最终校验和优化。`AdvisorService` 最终返回 verify 结果，并按要求仅打印“最终汇总模型输入”和“verify 输出”。

**Tech Stack:** TypeScript, Node.js fetch, OpenAI-compatible Chat Completions, Express

---

### Task 1: 新增 Responder / Verify 生成单元

**Files:**
- Create: `services/api/src/modules/advisor/agent_loop/responder.agent.ts`
- Create: `services/api/src/modules/advisor/agent_loop/verify.agent.ts`
- Modify: `services/api/src/modules/advisor/agent_loop/types.ts`

- [ ] **Step 1: 定义新增类型**
- [ ] **Step 2: 编写 responder 提示词与调用函数**
- [ ] **Step 3: 编写 verify 提示词与调用函数**
- [ ] **Step 4: 导出结构化输出（rawText/answer）**

### Task 2: 改造 Executor 输出以支持模型阅读

**Files:**
- Modify: `services/api/src/modules/advisor/agent_loop/executor.agent.ts`
- Modify: `services/api/src/modules/advisor/agent_loop/types.ts`

- [ ] **Step 1: 在 executor 返回体中加入可读上下文字段**
- [ ] **Step 2: 将每个工具结果聚合为 responder 可读文本**
- [ ] **Step 3: 保留原 steps 兼容 trace**

### Task 3: 串联 AdvisorService 主流程

**Files:**
- Modify: `services/api/src/modules/advisor/advisor.service.ts`

- [ ] **Step 1: 调 planner 与 executor**
- [ ] **Step 2: 调 responder 生成首轮答案（输入含 executor 结果）**
- [ ] **Step 3: 调 verify 生成最终答案并返回给前端**
- [ ] **Step 4: 失败时按 responder -> planner.answerDraft -> stub 回退**

### Task 4: 日志与配置

**Files:**
- Modify: `services/api/src/modules/advisor/advisor.service.ts`
- Modify: `services/api/.env.example`

- [ ] **Step 1: 仅打印最终汇总模型输入（responder input）**
- [ ] **Step 2: 打印 verify 输出**
- [ ] **Step 3: 配置 X 与 Verify 相关环境变量说明**

### Task 5: 验证

**Files:**
- Modify: `services/api/src/modules/advisor/**/*.ts`（本次改动文件）

- [ ] **Step 1: 运行类型/Lint 检查**
- [ ] **Step 2: 修复新增问题并确认可编译**
