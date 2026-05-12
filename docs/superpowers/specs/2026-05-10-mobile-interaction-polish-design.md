# Mobile Interaction Polish Design (Phase 2.2+)

## Goal

在现有移动端 IA 基线上，细化三项交互体验：

1. 悬浮分身拖拽释放后的吸边与回弹反馈。
2. 顾问回复的混合流式输出（先骨架句，再逐字补全）。
3. 顾问建议 chips 的轻量个性化（基于今日上下文和最近输入）。

本轮聚焦“产品体感增强”，不引入真实后端流式协议。

## Scope

### In Scope

- `apps/mobile/lib/core/app.dart`
  - 为悬浮分身加入“释放后吸附最近侧边”的动画行为。
- `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
  - 加入可打断的混合流式回复状态机。
  - 加入个性化建议 chips 的轻量规则生成。
- 对应测试文件
  - `apps/mobile/test/smoke/home_shell_navigation_test.dart`
  - `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

### Out of Scope

- 接入真实 API 流式协议（SSE/WebSocket）。
- 跨会话记忆增强和复杂推荐模型。
- 重构为独立 controller 层（本轮使用页面内最小状态机）。

## Architecture

### 1) Floating Pet Snap Behavior

在 `HomeShell` 中保留当前拖拽跟手逻辑，新增释放事件：

- 拖拽结束时读取当前位置和屏幕尺寸。
- 以悬浮分身中心点相对屏幕中线判断吸附方向：
  - 左半屏 -> 吸附左侧安全边距。
  - 右半屏 -> 吸附右侧安全边距。
- 使用短时动画（约 180-220ms，`easeOut`）完成吸边回弹。
- 纵向位置保持用户释放时高度，仅做边界 clamp。

### 2) Advisor Mixed Streaming State Machine

在 `AdvisorChatPage` 内增加以下状态：

- `int _replySessionId`：每次发送请求自增，用于打断旧流式任务。
- `bool _isStreaming`：当前是否正在输出中。
- `String _streamingText`：当前流式气泡内容。

执行流程：

1. 用户点击发送。
2. 立即 `++_replySessionId`，旧会话在下一次 tick 自动失效。
3. 先写入骨架句（快速反馈）。
4. 再按字符逐步补全详细内容（混合流式）。
5. 流结束后固化为普通顾问消息。

### 3) Personalized Suggestion Chips

建议来源优先级：

1. `fromTodayContext.challenge`
2. 最近一条用户消息
3. 默认建议兜底

规则采用轻量关键词映射，不引入 NLP：

- 命中“专注/深度工作” -> `帮我拆成 15 分钟起步动作`
- 命中“拖延/卡住” -> `先帮我识别当前最大阻碍`
- 命中“运动/跑步/训练” -> `给我一个今天可执行的最低标准`
- 无命中 -> 使用默认通用建议

交互保持不变：点击 chip 仅填充输入框，不自动发送。

## Interaction Details

### Streaming Mode

- 模式：混合流式（骨架句 + 逐字补全）。
- 发送策略：支持“打断当前回复并开始新回复”。
- 流式期间发送按钮保持可用。

### Interrupt Safety

- 每个异步流保存启动时的 `sessionId`。
- 每次更新 UI 前校验 `sessionId`，不一致则立即退出。
- `dispose` 时使当前会话失效，防止销毁后 `setState`。

### Snap Edge Safety

- 横向范围：`[12, maxWidth - petWidth - 12]`
- 纵向范围：`[safeTop, maxHeight - petHeight - safeBottom]`
- 极小屏场景下降级为直接定位，保证可见可点击。

## Testing Strategy (TDD)

### `advisor_chat_page_test.dart`

- 测试“骨架句先出现，后补全文本”。
- 测试“流式中二次发送会打断旧回复并转入新回复”。
- 测试“today context 能触发个性化建议 chips”。

### `home_shell_navigation_test.dart`

- 测试“悬浮分身拖拽释放后会吸附最近侧边”。

### Regression

- `cd apps/mobile && flutter test -r compact`

## Risks and Mitigations

- 风险：流式与中断并发导致 UI 抖动。
  - 方案：单一 `sessionId` 作为并发闸门。
- 风险：关键词匹配质量不足导致建议不稳定。
  - 方案：未命中时稳定回退到默认 chips。
- 风险：吸边动画在测试中不稳定。
  - 方案：测试以位置结果为准，减少对动画过程的强依赖。

## Acceptance Criteria

- 悬浮分身拖拽释放后总能吸附到左右边之一，不影响当前页面状态。
- 顾问回复具备混合流式效果，且可被新发送动作打断并重开。
- 个性化建议能根据上下文变化，且无命中时有清晰默认建议。
- 相关测试新增并通过，全量移动端测试通过。
