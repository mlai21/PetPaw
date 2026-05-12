# Mobile IA and Advisor Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端保持“今日/宣言书/顾问”独立分栏的前提下，打通“今日完成输入后携带上下文进入顾问并可返回今日锚点”的核心路径。

**Architecture:** 以 `PetPawApp` 的 `Stateful` Home Shell 作为唯一导航编排层，新增“从今日触发顾问”的显式事件通道；`TodayPage` 只负责采集与发送上下文，`AdvisorChatPage` 负责消费上下文和返回动作。悬浮分身保持交互层职责，仅保留拖拽与动作反馈，不再触发分页跳转。

**Tech Stack:** Flutter (`material`), flutter_test, existing bottom navigation shell

---

## File Structure

- Modify: `apps/mobile/lib/core/app.dart`
  - 负责底部 Tab 导航、页间事件分发、返回今日锚点恢复、悬浮分身交互边界。
- Modify: `apps/mobile/lib/features/today/today_page.dart`
  - 负责“昨日感谢 + 今日挑战”输入、完成态判断、底部 CTA 与上下文 payload 发射。
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
  - 负责接收 `fromToday` 上下文并注入顾问开场提示，暴露“返回今日”按钮回调。
- Modify: `apps/mobile/test/smoke/home_shell_navigation_test.dart`
  - 验证分栏稳定、悬浮分身不跳页、今日到顾问路径与返回锚点。
- Modify: `apps/mobile/test/features/today/today_page_ui_test.dart`
  - 验证今日页输入完成前后 CTA 的显隐和 payload 触发。
- Modify: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`
  - 验证顾问页上下文开场与“返回今日”动作。

---

### Task 1: Home Shell 导航编排与跨页事件通道

**Files:**
- Modify: `apps/mobile/lib/core/app.dart`
- Test: `apps/mobile/test/smoke/home_shell_navigation_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('floating pet tap does not switch tab to advisor', (tester) async {
  await tester.pumpWidget(const PetPawApp());
  expect(find.text('肯定昨天的自己'), findsOneWidget);

  await tester.tap(find.byKey(const Key('floating_pet')));
  await tester.pumpAndSettle();

  expect(find.text('肯定昨天的自己'), findsOneWidget);
  expect(find.text('你可以这样开始：'), findsNothing);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: FAIL because current `floating_pet` tap switches `_currentIndex` to advisor tab.

- [ ] **Step 3: Write minimal implementation**

```dart
// app.dart (_HomeShellState build)
_FloatingPet(
  onTap: () {}, // no tab switching
  onDragUpdate: (delta) { /* keep existing drag logic */ },
),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: PASS for the new test and existing shell tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/core/app.dart apps/mobile/test/smoke/home_shell_navigation_test.dart
git commit -m "refactor: keep floating pet as non-navigation interaction layer"
```

---

### Task 2: Today 页面完成态与“带上下文问顾问”入口

**Files:**
- Modify: `apps/mobile/lib/features/today/today_page.dart`
- Test: `apps/mobile/test/features/today/today_page_ui_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('today page shows advisor CTA only after two inputs are filled', (tester) async {
  Map<String, String>? emitted;
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: TodayPage(
          onAskAdvisor: (payload) => emitted = payload,
        ),
      ),
    ),
  );

  expect(find.text('带着今天的状态问顾问'), findsNothing);
  await tester.enterText(find.byKey(const Key('today_affirm_input')), '谢谢昨天坚持的自己');
  await tester.enterText(find.byKey(const Key('today_challenge_input')), '今晚完成30分钟深度工作');
  await tester.pump();

  expect(find.text('带着今天的状态问顾问'), findsOneWidget);
  await tester.tap(find.text('带着今天的状态问顾问'));
  await tester.pump();
  expect(emitted?['affirmation'], contains('昨天'));
  expect(emitted?['challenge'], contains('深度工作'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/today/today_page_ui_test.dart -r compact`  
Expected: FAIL because `TodayPage` has no text inputs, no CTA, no callback API.

- [ ] **Step 3: Write minimal implementation**

```dart
class TodayPage extends StatefulWidget {
  const TodayPage({super.key, this.onAskAdvisor});
  final ValueChanged<Map<String, String>>? onAskAdvisor;
}

// _TodayPageState fields
final _affirmController = TextEditingController();
final _challengeController = TextEditingController();

bool get _isComplete =>
    _affirmController.text.trim().isNotEmpty &&
    _challengeController.text.trim().isNotEmpty;

// build(): add two TextField with keys
TextField(
  key: const Key('today_affirm_input'),
  controller: _affirmController,
  onChanged: (_) => setState(() {}),
)
TextField(
  key: const Key('today_challenge_input'),
  controller: _challengeController,
  onChanged: (_) => setState(() {}),
)

if (_isComplete)
  FilledButton(
    onPressed: () => widget.onAskAdvisor?.call({
      'affirmation': _affirmController.text.trim(),
      'challenge': _challengeController.text.trim(),
    }),
    child: const Text('带着今天的状态问顾问'),
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/today/today_page_ui_test.dart -r compact`  
Expected: PASS with CTA visibility and payload assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/today/today_page.dart apps/mobile/test/features/today/today_page_ui_test.dart
git commit -m "feat: add today completion CTA for advisor context handoff"
```

---

### Task 3: Advisor 页面消费 Today 上下文并支持返回今日

**Files:**
- Modify: `apps/mobile/lib/features/advisor/advisor_chat_page.dart`
- Test: `apps/mobile/test/features/advisor/advisor_chat_page_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('advisor page renders today context guide and return button', (tester) async {
  var returned = false;
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: AdvisorChatPage(
          fromTodayContext: const {
            'affirmation': '谢谢昨天的自己',
            'challenge': '今天先完成最小行动',
          },
          onBackToToday: () => returned = true,
        ),
      ),
    ),
  );

  expect(find.text('我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？'), findsOneWidget);
  expect(find.text('返回今日'), findsOneWidget);
  await tester.tap(find.text('返回今日'));
  await tester.pump();
  expect(returned, isTrue);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: FAIL because `AdvisorChatPage` currently has neither `fromTodayContext` nor `onBackToToday`.

- [ ] **Step 3: Write minimal implementation**

```dart
class AdvisorChatPage extends StatefulWidget {
  const AdvisorChatPage({
    super.key,
    this.fromTodayContext,
    this.onBackToToday,
  });
  final Map<String, String>? fromTodayContext;
  final VoidCallback? onBackToToday;
}

@override
void initState() {
  super.initState();
  if (widget.fromTodayContext != null) {
    _messages.add(
      const _ChatMessage(
        role: 'advisor',
        text: '我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？',
      ),
    );
  }
}

if (widget.fromTodayContext != null && widget.onBackToToday != null)
  Align(
    alignment: Alignment.centerLeft,
    child: TextButton(
      onPressed: widget.onBackToToday,
      child: const Text('返回今日'),
    ),
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/advisor/advisor_chat_page_test.dart -r compact`  
Expected: PASS for context guide and return action behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/features/advisor/advisor_chat_page_test.dart
git commit -m "feat: support today-context advisor entry with back-to-today action"
```

---

### Task 4: Home Shell 串联 Today -> Advisor -> Today 锚点恢复

**Files:**
- Modify: `apps/mobile/lib/core/app.dart`
- Modify: `apps/mobile/lib/features/today/today_page.dart` (if callback signature adjustment needed)
- Test: `apps/mobile/test/smoke/home_shell_navigation_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
testWidgets('today completed CTA switches to advisor with context and can return to today', (tester) async {
  await tester.pumpWidget(const PetPawApp());

  await tester.enterText(find.byKey(const Key('today_affirm_input')), '昨天我完成了晨跑');
  await tester.enterText(find.byKey(const Key('today_challenge_input')), '今天完成一次专注工作');
  await tester.tap(find.text('带着今天的状态问顾问'));
  await tester.pumpAndSettle();

  expect(find.text('你可以这样开始：'), findsOneWidget);
  expect(find.text('返回今日'), findsOneWidget);

  await tester.tap(find.text('返回今日'));
  await tester.pumpAndSettle();
  expect(find.text('肯定昨天的自己'), findsOneWidget);
  expect(find.byKey(const Key('today_affirm_input')), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`  
Expected: FAIL because shell does not wire today callback to advisor context handoff.

- [ ] **Step 3: Write minimal implementation**

```dart
// app.dart (_HomeShellState fields)
Map<String, String>? _todayContextForAdvisor;
final _todayScrollAnchor = GlobalKey();

// _pages becomes builder-based to pass callbacks/state
Widget _buildPage(int index) {
  switch (index) {
    case 0:
      return TodayPage(
        pageAnchorKey: _todayScrollAnchor,
        onAskAdvisor: (payload) {
          setState(() {
            _todayContextForAdvisor = payload;
            _currentIndex = 2;
          });
        },
      );
    case 2:
      return AdvisorChatPage(
        fromTodayContext: _todayContextForAdvisor,
        onBackToToday: () {
          setState(() => _currentIndex = 0);
        },
      );
    default:
      return _pages[index];
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:
- `cd apps/mobile && flutter test test/smoke/home_shell_navigation_test.dart -r compact`
- `cd apps/mobile && flutter test test/features/today/today_page_ui_test.dart test/features/advisor/advisor_chat_page_test.dart -r compact`
- `cd apps/mobile && flutter test -r compact`

Expected: PASS across targeted and full suite.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/core/app.dart apps/mobile/lib/features/today/today_page.dart apps/mobile/lib/features/advisor/advisor_chat_page.dart apps/mobile/test/smoke/home_shell_navigation_test.dart
git commit -m "feat: wire today-advisor context flow with return-to-today continuity"
```

---

## Spec Coverage Self-Review

- 覆盖 `底部分栏独立`：Task 1 + Task 4（不改 Tab 架构，仅增强跨页入口）。
- 覆盖 `今日写完后可带上下文进入顾问`：Task 2 + Task 4。
- 覆盖 `顾问保持独立分页`：Task 3（上下文仅用于开场，不绑定数据层）。
- 覆盖 `点击悬浮分身不跳页`：Task 1。
- 覆盖 `返回今日连续性`：Task 3 + Task 4。
- 暂不纳入项（抽屉顾问、自动回写）未进入任务，符合 spec 边界。

## Placeholder Scan

- 未使用 TBD/TODO/implement later 等占位描述。
- 每个代码步骤均给出明确代码片段与执行命令。
- 每个任务均包含失败测试 -> 实现 -> 通过测试 -> 提交的完整闭环。
