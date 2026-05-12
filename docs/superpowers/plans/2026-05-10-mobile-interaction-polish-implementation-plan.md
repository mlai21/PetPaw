# Mobile Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端完成“悬浮分身吸边拖拽 + 顾问混合流式可打断 + 个性化建议 chips”三项交互细化，并保证回归稳定。

**Architecture:** 保持现有页面结构不变，在 `HomeShell` 内增强悬浮分身的释放吸边动画；在 `AdvisorChatPage` 内引入轻量 `sessionId` 流式状态机实现“骨架句 + 逐字补全 + 可打断”；基于 today context 或最近输入做关键词匹配生成建议 chips。全程按 TDD 小步推进。

**Tech Stack:** Flutter (`material`), flutter_test

---

## File Structure

- Modify: `apps/mobile/lib/core/app.dart`
  - 增加悬浮分身拖拽释放后的“吸边 + 回弹”行为，保持点击不跳页约束。
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
  - 增加可打断混合流式状态机（`_replySessionId`, `_isStreaming`, `_streamingText`）。
  - 增加个性化建议 chips 生成规则。
- Modify: `apps/mobile/test/smoke/home_shell_navigation_test.dart`
  - 增加“释放后吸边”的行为测试。
- Modify: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`
  - 增加“混合流式阶段输出 + 中断重开 + 个性化建议”测试。

---

### Task 1: 悬浮分身吸边拖拽

**Files:**
- Modify: `apps/mobile/lib/core/app.dart`
- Test: `apps/mobile/test/smoke/home_shell_navigation_test.dart`

- [x] **Step 1: Write the failing test**

```dart
testWidgets('floating pet snaps to nearest horizontal edge on drag end', (
  tester,
) async {
  await tester.pumpWidget(const PetPawApp());
  await tester.pump(const Duration(milliseconds: 200));

  final petFinder = find.byKey(const Key('floating_pet'));
  await tester.drag(petFinder, const Offset(-220, -40));
  await tester.pump(const Duration(milliseconds: 260));

  final leftPos = tester.getTopLeft(petFinder);
  expect(leftPos.dx, lessThanOrEqualTo(16));

  await tester.drag(petFinder, const Offset(280, 0));
  await tester.pump(const Duration(milliseconds: 260));

  final rightPos = tester.getTopLeft(petFinder);
  expect(rightPos.dx, greaterThan(240));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: FAIL because drag only follows pointer and has no snap-on-end behavior.

- [x] **Step 3: Write minimal implementation**

```dart
// app.dart (_HomeShellState)
static const _petHorizontalPadding = 12.0;

void _handlePetDragEnd(BoxConstraints constraints) {
  const petWidth = 104.0;
  const petHeight = 44.0;
  final maxLeft = constraints.maxWidth - petWidth;
  final maxTop = constraints.maxHeight - petHeight;
  final current = _petPosition ?? Offset(maxLeft - 16, maxTop - 20);
  final centerX = current.dx + petWidth / 2;
  final targetX = centerX < constraints.maxWidth / 2
      ? _petHorizontalPadding
      : maxLeft - _petHorizontalPadding;

  setState(() {
    _petPosition = Offset(
      targetX.clamp(0, maxLeft),
      current.dy.clamp(0, maxTop),
    );
  });
}

// _FloatingPet API
const _FloatingPet({
  required this.onTap,
  required this.onDragUpdate,
  required this.onDragEnd,
});
final VoidCallback onDragEnd;

// GestureDetector
onPanEnd: (_) => widget.onDragEnd(),
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: PASS including existing shell navigation tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/core/app.dart apps/mobile/test/smoke/home_shell_navigation_test.dart
git commit -m "feat: add floating pet snap-to-edge drag behavior"
```

---

### Task 2: 顾问混合流式回复（骨架句 + 逐字补全）

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [x] **Step 1: Write the failing test**

```dart
testWidgets('advisor reply streams from scaffold to detailed text', (tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: AdvisorChatPage())),
  );

  await tester.enterText(find.byType(TextField), '帮我启动今天的任务');
  await tester.tap(find.text('发送'));
  await tester.pump();

  expect(find.textContaining('先帮你定个起步骨架'), findsOneWidget);
  expect(find.text('收到，我来帮你拆解。'), findsNothing);

  await tester.pump(const Duration(milliseconds: 1400));
  expect(find.text('收到，我来帮你拆解。'), findsOneWidget);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL because current implementation only has fixed delay + single final response.

- [x] **Step 3: Write minimal implementation**

```dart
int _replySessionId = 0;
bool _isStreaming = false;
String _streamingText = '';

Future<void> _sendMessage() async {
  final text = _controller.text.trim();
  if (text.isEmpty) return;

  final sessionId = ++_replySessionId;
  setState(() {
    _messages.add(_ChatMessage(role: 'user', text: text));
    _isStreaming = true;
    _streamingText = '收到，我先帮你定个起步骨架...';
  });
  _controller.clear();

  await Future<void>.delayed(const Duration(milliseconds: 120));
  final full = '收到，我来帮你拆解。';
  for (var i = 0; i < full.length; i++) {
    if (!mounted || sessionId != _replySessionId) return;
    await Future<void>.delayed(const Duration(milliseconds: 30));
    setState(() => _streamingText = full.substring(0, i + 1));
  }

  if (!mounted || sessionId != _replySessionId) return;
  setState(() {
    _isStreaming = false;
    _messages.add(_ChatMessage(role: 'advisor', text: full));
    _streamingText = '';
  });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS for existing tests + new streaming phase test.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat: add hybrid streaming advisor reply experience"
```

---

### Task 3: 流式可打断重开（新发送打断旧回复）

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [x] **Step 1: Write the failing test**

```dart
testWidgets('new send interrupts active stream and starts latest reply', (tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: AdvisorChatPage())),
  );

  await tester.enterText(find.byType(TextField), '先回答A');
  await tester.tap(find.text('发送'));
  await tester.pump(const Duration(milliseconds: 180));

  await tester.enterText(find.byType(TextField), '改成回答B');
  await tester.tap(find.text('发送'));
  await tester.pump(const Duration(milliseconds: 1200));

  expect(find.text('改成回答B'), findsOneWidget);
  expect(find.textContaining('A'), findsNothing);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL because current streaming state blocks/does not cancel previous flow correctly.

- [x] **Step 3: Write minimal implementation**

```dart
Future<void> _sendMessage() async {
  final text = _controller.text.trim();
  if (text.isEmpty) return;

  // 新发送始终启动新 session，旧 session 自动失效
  final sessionId = ++_replySessionId;

  // ... existing streaming logic ...
  // 每次 tick 校验:
  if (!mounted || sessionId != _replySessionId) return;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS and no flaky timing failures.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat: support interrupt-and-restart advisor streaming"
```

---

### Task 4: 个性化建议 chips

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [x] **Step 1: Write the failing test**

```dart
testWidgets('advisor shows personalized chips from today challenge context', (
  tester,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: AdvisorChatPage(
          fromTodayContext: const {'challenge': '今晚完成30分钟深度工作'},
        ),
      ),
    ),
  );

  expect(find.text('帮我拆成 15 分钟起步动作'), findsOneWidget);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL because current chips are static and not context-aware.

- [x] **Step 3: Write minimal implementation**

```dart
List<String> _buildSuggestionChips(String source) {
  if (source.contains('专注') || source.contains('深度工作')) {
    return ['帮我拆成 15 分钟起步动作', '先帮我安排前 30 分钟节奏'];
  }
  if (source.contains('拖延') || source.contains('卡住')) {
    return ['先帮我识别当前最大阻碍', '给我一个马上能做的最小动作'];
  }
  if (source.contains('运动') || source.contains('跑步') || source.contains('训练')) {
    return ['给我一个今天可执行的最低标准', '帮我把运动目标降到不会失败'];
  }
  return ['帮我拆解今天最重要的一步', '我卡住了，给我一个最小行动'];
}

@override
void initState() {
  super.initState();
  final source = widget.fromTodayContext?['challenge'] ?? '';
  _suggestionChips = _buildSuggestionChips(source);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS including all advisor page tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat: personalize advisor suggestion chips from context"
```

---

### Task 5: 全量回归与文档更新

**Files:**
- Modify: `progress.md`

- [x] **Step 1: Run full verification**

Run:
- `cd apps/mobile && flutter test -r compact`
- `cd services/api && pnpm test`

Expected: PASS across all suites.

- [x] **Step 2: Lint check for touched files**

Run: `ReadLints` (paths limited to modified mobile files)  
Expected: No new lint errors.

- [x] **Step 3: Update progress log**

```md
### [YYYY-MM-DD HH:mm] [窗口: 当前会话] [任务: 交互细化实现完成]
- 操作: 完成吸边拖拽、混合流式可打断、个性化建议 chips。
- 文件: `apps/mobile/lib/core/app.dart`, `apps/mobile/lib/features/advisor/advisor_chat_page.dart`, `apps/mobile/test/...`, `progress.md`
- 验证: `flutter test` PASS；`pnpm test` PASS；`ReadLints` 无新增错误。
- 决策: 保持页面内轻量状态机，后续再抽 controller。
- 下一步: 根据需要创建 PR 或继续迭代视觉细节。
```

- [ ] **Step 4: Commit**

```bash
git add progress.md
git commit -m "docs: record interaction polish implementation progress"
```

---

## Spec Coverage Self-Review

- 覆盖 `吸边拖拽`：Task 1。
- 覆盖 `混合流式`：Task 2。
- 覆盖 `可打断重开`：Task 3。
- 覆盖 `个性化建议`：Task 4。
- 覆盖 `测试与回归`：Task 5。

## Placeholder Scan

- 无 TBD/TODO/implement later。
- 每个任务都有失败测试、验证命令、最小实现和提交步骤。
- 关键类型和字段名在任务内保持一致（`_replySessionId`, `_isStreaming`, `_streamingText`）。
