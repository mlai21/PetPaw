# Mobile Interaction Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持现有 IA 和交互边界不变的前提下，完成吸边动画、流式节奏与个性化建议的均衡型微调并通过稳定测试。

**Architecture:** 沿用现有页面内轻量状态机，不引入新 controller 层。`HomeShell` 仅替换吸边触发方式与动画曲线；`AdvisorChatPage` 仅调整流式时间参数并扩展关键词映射；测试层以“阶段性断言 + 结果断言”为主，降低时序脆弱性。

**Tech Stack:** Flutter (`material`), flutter_test

---

## File Structure

- Modify: `apps/mobile/lib/core/app.dart`
  - 将 floating pet 的“延迟后瞬移吸边”改为“释放后立即短动画吸边”。
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
  - 调整骨架停留与逐字补全节奏参数。
  - 扩展 chips 关键词映射（拖延/运动/复盘）。
- Modify: `apps/mobile/test/smoke/home_shell_navigation_test.dart`
  - 调整吸边测试为“开始移动 + 最终贴边”。
- Modify: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`
  - 增加流式节奏与 chips 语义扩展测试。

---

### Task 1: Floating Pet 吸边动画微调

**Files:**
- Modify: `apps/mobile/lib/core/app.dart`
- Test: `apps/mobile/test/smoke/home_shell_navigation_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('floating pet starts snapping immediately and settles near edge', (
  tester,
) async {
  await tester.pumpWidget(const PetPawApp());
  await tester.pump(const Duration(milliseconds: 120));

  final petFinder = find.byKey(const Key('floating_pet'));
  final before = tester.getTopLeft(petFinder);

  await tester.drag(petFinder, const Offset(-220, -20));
  await tester.pump(const Duration(milliseconds: 40));
  final during = tester.getTopLeft(petFinder);
  expect(during.dx, lessThan(before.dx));

  await tester.pump(const Duration(milliseconds: 220));
  final settled = tester.getTopLeft(petFinder);
  expect(settled.dx, lessThanOrEqualTo(12));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: FAIL because current implementation uses delayed snap callback, not immediate animation-like settling.

- [ ] **Step 3: Write minimal implementation**

```dart
// app.dart
static const Duration _petSnapDuration = Duration(milliseconds: 180);
static const Curve _petSnapCurve = Curves.easeOutBack;

// In _HomeShellState, store animation progress simply with tweened updates
void _snapPetToEdge({
  required Offset from,
  required Offset to,
  required int snapVersion,
}) async {
  const steps = 6;
  for (var i = 1; i <= steps; i++) {
    await Future<void>.delayed(_petSnapDuration ~/ steps);
    if (!mounted || snapVersion != _petSnapVersion) return;
    final t = _petSnapCurve.transform(i / steps);
    setState(() => _petPosition = Offset.lerp(from, to, t));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: PASS including existing “设置页隐藏”和“点击不跳页”断言。

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/core/app.dart apps/mobile/test/smoke/home_shell_navigation_test.dart
git commit -m "refactor: smooth floating pet edge snap animation"
```

---

### Task 2: 混合流式节奏参数优化（均衡）

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('advisor streaming enters detail phase sooner with two-speed ticks', (
  tester,
) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: AdvisorChatPage())),
  );

  await tester.enterText(find.byType(TextField), '帮我开始今天任务');
  await tester.tap(find.text('发送'));
  await tester.pump();
  expect(find.textContaining('收到，我来帮你拆解。'), findsOneWidget);

  await tester.pump(const Duration(milliseconds: 220));
  expect(find.textContaining('先从最小行动开始'), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL if existing hold/tick timing does not satisfy updated cadence.

- [ ] **Step 3: Write minimal implementation**

```dart
// advisor_chat_page.dart constants
static const Duration _skeletonHold = Duration(milliseconds: 220);
static const Duration _streamTickFast = Duration(milliseconds: 18);
static const Duration _streamTickNormal = Duration(milliseconds: 24);
static const int _fastTickChars = 12;

for (var end = _skeletonReply.length + 1; end <= _fullReply.length; end++) {
  final step = end - _skeletonReply.length;
  await Future<void>.delayed(
    step <= _fastTickChars ? _streamTickFast : _streamTickNormal,
  );
  if (!mounted || sessionId != _streamSessionId) return;
  setState(() {
    _messages[_messages.length - 1] = _ChatMessage(
      role: 'advisor',
      text: _fullReply.substring(0, end),
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS for existing streaming + interrupt tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "perf: tune advisor hybrid streaming pace for balanced feel"
```

---

### Task 3: 个性化 chips 语义扩展

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('advisor maps procrastination and review keywords to chips', (
  tester,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: AdvisorChatPage(
          fromTodayContext: const {'challenge': '我有点拖延，今晚先复盘'},
        ),
      ),
    ),
  );

  expect(find.text('先帮我识别当前最大阻碍'), findsOneWidget);
  expect(find.text('先帮我列出今天最关键的1条复盘点'), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL because only current keyword map exists.

- [ ] **Step 3: Write minimal implementation**

```dart
String? _resolveContextChip() {
  final challenge = widget.fromTodayContext?['challenge']?.trim();
  if (challenge == null || challenge.isEmpty) return null;

  if (challenge.contains('深度工作') || challenge.contains('专注')) {
    return _focusKickoffChip;
  }
  if (challenge.contains('拖延') || challenge.contains('卡住') || challenge.contains('开始不了')) {
    return '先帮我识别当前最大阻碍';
  }
  if (challenge.contains('运动') || challenge.contains('跑步') || challenge.contains('训练')) {
    return '给我一个今天可执行的最低标准';
  }
  if (challenge.contains('复盘') || challenge.contains('总结')) {
    return '先帮我列出今天最关键的1条复盘点';
  }
  return _fallbackContextChip;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS including fallback test.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat: extend advisor chip mapping for common challenge intents"
```

---

### Task 4: 全量回归与记录

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run targeted regressions**

Run:
- `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`
- `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`

Expected: PASS.

- [ ] **Step 2: Run full mobile regression**

Run: `cd apps/mobile && flutter test -r compact`  
Expected: PASS all suites.

- [ ] **Step 3: Lint check**

Run: `ReadLints` on touched files in `core/app.dart`, `advisor_chat_page.dart`, and relevant tests.  
Expected: no new lint errors.

- [ ] **Step 4: Update progress log**

```md
### [YYYY-MM-DD HH:mm] [窗口: 当前会话] [任务: 交互微调 Round 2 实现完成]
- 操作: 完成吸边动画顺滑化、流式节奏均衡调参、chips 语义扩展并回归。
- 文件: `apps/mobile/lib/core/app.dart`, `apps/mobile/lib/features/advisor/advisor_chat_page.dart`, `apps/mobile/test/...`, `progress.md`
- 验证: `flutter test` PASS；`ReadLints` 无新增错误。
- 决策: 保持轻量参数驱动，后续若接真实流式再抽控制层。
- 下一步: 选择提交/推送/PR流程。
```

- [ ] **Step 5: Commit**

```bash
git add progress.md
git commit -m "docs: record round2 interaction polish progress"
```

---

## Spec Coverage Self-Review

- 覆盖 `吸边顺滑化`：Task 1。  
- 覆盖 `流式节奏均衡参数`：Task 2。  
- 覆盖 `chips 语义扩展`：Task 3。  
- 覆盖 `测试与回归要求`：Task 4。

## Placeholder Scan

- 无 TBD/TODO 等占位符。  
- 每个任务包含“失败测试 -> 失败验证 -> 最小实现 -> 通过验证 -> 提交”闭环。  
- 参数和字段命名保持一致（`_skeletonHold`, `_streamTickFast`, `_streamTickNormal`, `_petSnapDuration`）。
