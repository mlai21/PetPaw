# Avatar Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端落地“手机号注册后进入分身创建向导（4 候选生成/重跑 + 命名必填 + 期望选填）”，并在 API 侧补齐对应契约占位，形成可迭代闭环。

**Architecture:** 保持现有 Flutter 导航结构与 `settings -> auth` 入口，先完成可运行 UI 状态机与本地契约，再接入服务端占位接口（auth + avatar generation）。分身创建采用 2 步向导，Step 1 聚焦生成与选择，Step 2 聚焦命名与期望；声音相关能力明确后置。

**Tech Stack:** Flutter (`material`, `flutter_test`), TypeScript + Express (`jest`, `supertest`), 现有 `services/api` 模块化结构。

---

## File Structure

- Modify: `apps/mobile/lib/features/auth/login_page.dart`
- Modify: `apps/mobile/lib/features/auth/register_page.dart`
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_page.dart`
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_models.dart`
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_repository.dart`
- Modify: `apps/mobile/lib/features/settings/settings_page.dart`（注册完成后回跳逻辑）
- Modify: `apps/mobile/test/features/auth/auth_navigation_test.dart`
- Create: `apps/mobile/test/features/onboarding/avatar_onboarding_page_test.dart`
- Create: `services/api/src/modules/auth/auth.controller.ts`
- Create: `services/api/src/modules/avatar/avatar_onboarding.controller.ts`
- Modify: `services/api/src/index.ts`
- Create: `services/api/test/auth/phone_auth_contract.test.ts`
- Create: `services/api/test/avatar/avatar_onboarding_contract.test.ts`
- Modify: `progress.md`

---

### Task 1: 手机号验证码注册/登录 UI 契约替换

**Files:**
- Modify: `apps/mobile/lib/features/auth/login_page.dart`
- Modify: `apps/mobile/lib/features/auth/register_page.dart`
- Modify: `apps/mobile/test/features/auth/auth_navigation_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
// apps/mobile/test/features/auth/auth_navigation_test.dart
expect(find.byKey(const Key('login_phone')), findsOneWidget);
expect(find.byKey(const Key('register_phone')), findsOneWidget);
expect(find.byKey(const Key('register_code')), findsOneWidget);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/auth/auth_navigation_test.dart -r compact`  
Expected: FAIL with missing phone/code fields.

- [ ] **Step 3: Write minimal implementation**

```dart
// login_page.dart（关键字段）
TextFormField(
  key: const Key('login_phone'),
  keyboardType: TextInputType.phone,
  decoration: const InputDecoration(labelText: '手机号', border: OutlineInputBorder()),
);
TextFormField(
  key: const Key('login_code'),
  keyboardType: TextInputType.number,
  decoration: const InputDecoration(labelText: '验证码', border: OutlineInputBorder()),
);

// register_page.dart（关键字段）
TextFormField(
  key: const Key('register_phone'),
  keyboardType: TextInputType.phone,
  decoration: const InputDecoration(labelText: '手机号', border: OutlineInputBorder()),
);
TextFormField(
  key: const Key('register_code'),
  keyboardType: TextInputType.number,
  decoration: const InputDecoration(labelText: '验证码', border: OutlineInputBorder()),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/auth/auth_navigation_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/auth apps/mobile/test/features/auth/auth_navigation_test.dart
git commit -m "feat: switch auth ui to phone verification flow"
```

---

### Task 2: 新增分身创建向导数据模型与仓储接口

**Files:**
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_models.dart`
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_repository.dart`
- Create: `apps/mobile/test/features/onboarding/avatar_onboarding_models_test.dart`

- [ ] **Step 1: Write the failing model test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/onboarding/avatar_onboarding_models.dart';

void main() {
  test('advisor name validation requires 2-12 chars', () {
    expect(validateAdvisorName('A'), isFalse);
    expect(validateAdvisorName('分身顾问'), isTrue);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_models_test.dart -r compact`  
Expected: FAIL with file/symbol missing.

- [ ] **Step 3: Write minimal implementation**

```dart
class AvatarCandidate {
  const AvatarCandidate({required this.id, required this.imageUrl, this.previewHint = ''});
  final String id;
  final String imageUrl;
  final String previewHint;
}

bool validateAdvisorName(String value) {
  final v = value.trim();
  return v.length >= 2 && v.length <= 12;
}

abstract class AvatarOnboardingRepository {
  Future<List<AvatarCandidate>> generateCandidates({
    required List<String> localImagePaths,
    required String style,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_models_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/onboarding apps/mobile/test/features/onboarding/avatar_onboarding_models_test.dart
git commit -m "feat: add avatar onboarding model and repository contracts"
```

---

### Task 3: 实现分身创建 Step 1（上传/风格/4候选/重跑/选择）

**Files:**
- Create: `apps/mobile/lib/features/onboarding/avatar_onboarding_page.dart`
- Create: `apps/mobile/test/features/onboarding/avatar_onboarding_page_test.dart`

- [ ] **Step 1: Write the failing Step 1 UI test**

```dart
testWidgets('step1 generates four candidates and requires selection', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: AvatarOnboardingPage()));
  expect(find.text('Step 1/2 创建你的顾问分身'), findsOneWidget);
  await tester.tap(find.byKey(const Key('generate_candidates')));
  await tester.pumpAndSettle();
  expect(find.byKey(const Key('candidate_grid')), findsOneWidget);
  expect(find.byKey(const Key('next_step')), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_page_test.dart -r compact`  
Expected: FAIL with page/keys missing.

- [ ] **Step 3: Write minimal implementation**

```dart
// 关键行为：点击生成返回4候选，必须选择后才能继续
FilledButton(
  key: const Key('generate_candidates'),
  onPressed: _isGenerating ? null : _onGenerate,
  child: Text(_isGenerating ? '生成中...' : '生成 4 个候选'),
);

Wrap(
  key: const Key('candidate_grid'),
  children: _candidates.map((c) {
    final selected = _selectedId == c.id;
    return ChoiceChip(
      key: Key('candidate_${c.id}'),
      label: Text(c.id),
      selected: selected,
      onSelected: (_) => setState(() => _selectedId = c.id),
    );
  }).toList(),
);

FilledButton(
  key: const Key('next_step'),
  onPressed: _selectedId == null ? null : () => setState(() => _step = 2),
  child: const Text('继续'),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_page_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/onboarding/avatar_onboarding_page.dart apps/mobile/test/features/onboarding/avatar_onboarding_page_test.dart
git commit -m "feat: implement avatar onboarding step1 candidate generation flow"
```

---

### Task 4: 实现 Step 2（分身命名必填 + 期望选填）与完成回调

**Files:**
- Modify: `apps/mobile/lib/features/onboarding/avatar_onboarding_page.dart`
- Modify: `apps/mobile/test/features/onboarding/avatar_onboarding_page_test.dart`

- [ ] **Step 1: Write the failing Step 2 validation test**

```dart
testWidgets('step2 requires advisor name and allows optional expectation', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: AvatarOnboardingPage()));
  // 进入 step2（前置选择一个候选）
  await tester.tap(find.byKey(const Key('generate_candidates')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('candidate_c1')));
  await tester.tap(find.byKey(const Key('next_step')));
  await tester.pumpAndSettle();

  await tester.tap(find.byKey(const Key('finish_onboarding')));
  await tester.pump();
  expect(find.text('请先给分身起名字'), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_page_test.dart -r compact`  
Expected: FAIL with no name validation.

- [ ] **Step 3: Write minimal implementation**

```dart
final _nameController = TextEditingController();
final _expectationController = TextEditingController();
String? _nameError;

void _finish() {
  if (!validateAdvisorName(_nameController.text)) {
    setState(() => _nameError = '请先给分身起名字');
    return;
  }
  widget.onFinished?.call(
    selectedCandidateId: _selectedId!,
    advisorName: _nameController.text.trim(),
    expectation: _expectationController.text.trim(),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/onboarding/avatar_onboarding_page_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/onboarding/avatar_onboarding_page.dart apps/mobile/test/features/onboarding/avatar_onboarding_page_test.dart
git commit -m "feat: enforce advisor naming and optional expectation in onboarding step2"
```

---

### Task 5: 注册成功后路由到分身创建向导

**Files:**
- Modify: `apps/mobile/lib/features/auth/register_page.dart`
- Modify: `apps/mobile/lib/features/settings/settings_page.dart`
- Modify: `apps/mobile/test/features/auth/auth_navigation_test.dart`

- [ ] **Step 1: Write the failing navigation test**

```dart
testWidgets('register submit navigates to avatar onboarding page', (tester) async {
  await tester.pumpWidget(const PetPawApp(advisorRepository: StubAdvisorChatRepository()));
  await tester.tap(find.byIcon(Icons.settings));
  await tester.pumpAndSettle();
  await tester.tap(find.text('账户登录'));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('login_go_register')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('register_phone')), '13800138000');
  await tester.enterText(find.byKey(const Key('register_code')), '123456');
  await tester.tap(find.byKey(const Key('register_submit')));
  await tester.pumpAndSettle();
  expect(find.text('Step 1/2 创建你的顾问分身'), findsOneWidget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/auth/auth_navigation_test.dart -r compact`  
Expected: FAIL since register currently stays on same page/snackbar only.

- [ ] **Step 3: Write minimal implementation**

```dart
onPressed: () {
  if (!(_formKey.currentState?.validate() ?? false)) return;
  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => const AvatarOnboardingPage(),
    ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/auth/auth_navigation_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features/auth/register_page.dart apps/mobile/lib/features/settings/settings_page.dart apps/mobile/test/features/auth/auth_navigation_test.dart
git commit -m "feat: route newly registered users to avatar onboarding wizard"
```

---

### Task 6: API 契约占位（手机号鉴权 + 分身候选生成）

**Files:**
- Create: `services/api/src/modules/auth/auth.controller.ts`
- Create: `services/api/src/modules/avatar/avatar_onboarding.controller.ts`
- Modify: `services/api/src/index.ts`
- Create: `services/api/test/auth/phone_auth_contract.test.ts`
- Create: `services/api/test/avatar/avatar_onboarding_contract.test.ts`

- [ ] **Step 1: Write the failing API contract tests**

```ts
// phone_auth_contract.test.ts
it('accepts phone and code for login/register', async () => {
  const res = await request(app).post('/auth/phone/verify').send({ phone: '13800138000', code: '123456' });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('token');
});

// avatar_onboarding_contract.test.ts
it('returns 4 candidates for selected style', async () => {
  const res = await request(app).post('/avatar/onboarding/generate').send({
    style: 'anime',
    imageRefs: ['mock://img1'],
  });
  expect(res.status).toBe(200);
  expect(res.body.candidates).toHaveLength(4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/auth/phone_auth_contract.test.ts test/avatar/avatar_onboarding_contract.test.ts`  
Expected: FAIL with routes missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// auth.controller.ts
import { Router } from 'express';
export const authRouter = Router();
authRouter.post('/phone/verify', (_req, res) => {
  res.json({ token: 'mock-token', userId: 'u_mock' });
});

// avatar_onboarding.controller.ts
import { Router } from 'express';
export const avatarOnboardingRouter = Router();
avatarOnboardingRouter.post('/onboarding/generate', (_req, res) => {
  res.json({
    candidates: [
      { id: 'c1', imageUrl: 'mock://c1' },
      { id: 'c2', imageUrl: 'mock://c2' },
      { id: 'c3', imageUrl: 'mock://c3' },
      { id: 'c4', imageUrl: 'mock://c4' },
    ],
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/auth/phone_auth_contract.test.ts test/avatar/avatar_onboarding_contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/index.ts services/api/src/modules/auth services/api/src/modules/avatar services/api/test/auth services/api/test/avatar
git commit -m "feat: add phone auth and avatar onboarding api contracts"
```

---

### Task 7: 全量回归、文档同步与进度记录

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run full verification**

Run:
- `cd apps/mobile && flutter test -r compact`
- `cd services/api && pnpm test`

Expected: PASS across mobile/api suites.

- [ ] **Step 2: Lint check for changed files**

Run: `ReadLints` on:
- `apps/mobile/lib/features/auth`
- `apps/mobile/lib/features/onboarding`
- `services/api/src/modules/auth`
- `services/api/src/modules/avatar`

Expected: no new lints.

- [ ] **Step 3: Update progress log**

```md
### [YYYY-MM-DD HH:mm] [窗口: 当前会话] [任务: 注册后分身创建向导落地]
- 操作: 完成手机号注册流与分身创建 2 步向导（4 候选生成/重跑/选择 + 命名必填 + 期望选填），并补齐 API 占位契约。
- 文件: `apps/mobile/lib/features/auth/**`, `apps/mobile/lib/features/onboarding/**`, `services/api/src/modules/auth/**`, `services/api/src/modules/avatar/**`, `progress.md`
- 验证: `flutter test` PASS；`pnpm test` PASS；`ReadLints` 无新增错误。
- 决策: 声音输入与语音生成维持后置，避免首版复杂度失控。
- 下一步: 对接真实图像生成服务与鉴权 token 存储策略。
```

- [ ] **Step 4: Commit**

```bash
git add progress.md
git commit -m "docs: record avatar onboarding implementation progress"
```

---

## Spec Coverage Self-Review

- 覆盖 `手机号注册后进入分身创建`：Task 1 + Task 5。
- 覆盖 `Step1 4候选生成/重跑/选择`：Task 3 + Task 6。
- 覆盖 `分身命名必填、期望选填`：Task 4。
- 覆盖 `一期声音能力后置`：本计划未引入声音输入代码，保持与 spec 一致。
- 覆盖 `多窗口协作可追踪`：Task 7 写入 `progress.md`。

## Placeholder Scan

- 无 `TODO`/`TBD` 类型占位描述。
- 每个任务都有失败测试、实现片段、验证命令、提交步骤。
- 核心命名保持一致：`AvatarOnboardingPage`、`AvatarCandidate`、`validateAdvisorName`。
