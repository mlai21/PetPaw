# Mobile Interaction Polish Round 2 Design

## Goal

在不改变现有 IA 和核心交互原则的前提下，对移动端做一轮“均衡型”体感微调，覆盖：

1. 悬浮分身吸边拖拽的动画顺滑度。
2. 顾问混合流式回复节奏（更快起步，保持两阶段可感知）。
3. 个性化建议 chips 的语义覆盖面。

## Scope

### In Scope

- `apps/mobile/lib/core/app.dart`
  - 将“释放后延迟跳变吸边”优化为“立即进入短动画吸边”。
- `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
  - 调整混合流式参数（骨架停留与逐字速度）。
  - 扩展关键词映射（拖延/运动/复盘）并保留兜底建议。
- `apps/mobile/test/smoke/home_shell_navigation_test.dart`
  - 调整吸边测试断言，避免依赖脆弱时间点。
- `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`
  - 覆盖新流式节奏与新增语义 chips。

### Out of Scope

- 真实网络流式协议（SSE/WebSocket）接入。
- 复杂 NLP 或模型驱动推荐。
- 导航结构、页面布局与信息架构调整。

## Interaction Design

### 1) Floating Pet Snap（均衡体感）

- 吸边总时长：`180ms`。
- 动画曲线：`Curves.easeOutBack`（轻回弹，避免夸张弹跳）。
- `onPanEnd` 后立即进入吸边动画，而不是延迟后瞬移。
- 吸边目标仍为最近左右边（保留边距 `12`）。

验收感知：
- 松手后 1 帧内可感知到位移开始。
- 约 200ms 内稳定贴边完成。

### 2) Hybrid Streaming Pace（均衡节奏）

- 骨架句停留：从 `300ms` 调整为 `220ms`。
- 逐字阶段分段速度：
  - 前 12 字：`18ms/tick`
  - 后续：`24ms/tick`
- 保持“新发送立即打断旧 session 并重开”的规则不变。

验收感知：
- 仍能明显感知“骨架句 -> 补全细节”两阶段。
- 相比上一版更快进入实质内容。

### 3) Personalized Chips（小幅扩展）

在现有 `深度工作/专注` 基础上补充：

- `拖延/卡住/开始不了` -> `先帮我识别当前最大阻碍`
- `运动/跑步/训练` -> `给我一个今天可执行的最低标准`
- `复盘/总结` -> `先帮我列出今天最关键的1条复盘点`

无命中仍使用兜底建议，不出现空状态。
点击 chips 继续保持“仅填充输入框，不自动发送”。

## Testing Strategy

### `home_shell_navigation_test.dart`

- 断言“释放后开始移动 + 最终贴边”，避免依赖像素级动画轨迹。
- 保留“设置页隐藏 floating pet”和“点击不跳页”的既有断言。

### `advisor_chat_page_test.dart`

- 流式三段断言：
  1. 发送后立刻看到骨架句。
  2. `pump(220ms)` 后开始出现补全文字。
  3. 足够时间后出现完整句。
- 打断用例继续校验“旧流式文本不残留，最新会话成功完成”。
- 新增 chips 语义用例：
  - 拖延/卡住
  - 复盘/总结
  - fallback

### Regression

- `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`
- `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`
- `cd apps/mobile && flutter test -r compact`

## Constraints and Non-goals

- 不改变导航、分页、入口策略。
- 不改变 floating pet 点击行为（不触发跳页）。
- 不改变 chips 点击行为（只填充输入）。
- 仅做参数与小规则微调，控制风险与迭代成本。

## Acceptance Criteria

- 吸边拖拽观感更顺滑，且最终稳定吸附左右边。
- 流式回复感知更快但仍保持两阶段特征。
- 个性化 chips 覆盖更多常见语义并保持兜底可用。
- 相关测试稳定通过，移动端全量回归通过。
