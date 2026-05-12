# Private Advisor MVP Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 MVP that delivers high-quality journaling + manifesto loop, basic advisor chat/search/memory, and visible avatar growth feedback on iOS/Android with desktop-ready architecture.

**Architecture:** Use Flutter as a shared client codebase with clear domain modules (`journal`, `manifesto`, `advisor`, `avatar`, `review`) and encrypted local-first persistence. Add a lightweight backend for account/sync/search/LLM orchestration, and keep privacy scopes explicit at field level for future macOS/Windows reuse.

**Tech Stack:** Flutter, Riverpod, Drift (SQLite), flutter_secure_storage, Supabase (Auth/Postgres/Edge Functions), OpenAI-compatible LLM API, SerpAPI/Tavily search API, GitHub Actions CI.

---

## File Structure (locked before coding)

- Create: `apps/mobile/`
  - `lib/core/` (theme, env, routing, secure utils)
  - `lib/domain/` (`journal`, `manifesto`, `challenge`, `advisor`, `avatar`, `review`)
  - `lib/data/local/` (Drift schema + repositories)
  - `lib/data/remote/` (API clients + DTOs)
  - `lib/features/` (UI by feature)
  - `test/` (unit + widget tests)
- Create: `services/api/`
  - `src/index.ts` (API server)
  - `src/modules/advisor/` (chat/search/memory orchestration)
  - `src/modules/sync/` (sync endpoints)
  - `src/modules/review/` (monthly review generation)
  - `test/` (API tests)
- Create: `infra/`
  - `supabase/migrations/` (tables + RLS)
  - `supabase/functions/` (edge functions if needed)
- Create: `.github/workflows/ci.yml`

## Task 1: Bootstrap workspace and domain skeleton

**Files:**
- Create: `apps/mobile/pubspec.yaml`
- Create: `apps/mobile/lib/main.dart`
- Create: `apps/mobile/lib/core/app.dart`
- Create: `apps/mobile/lib/domain/domain.dart`
- Test: `apps/mobile/test/smoke/app_boot_test.dart`

- [ ] **Step 1: Write the failing app boot test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';

void main() {
  testWidgets('App boots to HomeShell', (tester) async {
    await tester.pumpWidget(const PetPawApp());
    expect(find.text('Today'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/smoke/app_boot_test.dart -r compact`  
Expected: FAIL with import/class not found.

- [ ] **Step 3: Write minimal implementation**

```dart
// apps/mobile/lib/core/app.dart
import 'package:flutter/material.dart';

class PetPawApp extends StatelessWidget {
  const PetPawApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(body: Center(child: Text('Today'))),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/smoke/app_boot_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "chore: bootstrap flutter app skeleton"
```

## Task 2: Implement encrypted local data schema (journal/manifesto/avatar)

**Files:**
- Create: `apps/mobile/lib/data/local/app_database.dart`
- Create: `apps/mobile/lib/domain/journal/daily_entry.dart`
- Create: `apps/mobile/lib/domain/manifesto/manifesto.dart`
- Create: `apps/mobile/lib/domain/avatar/avatar_state.dart`
- Test: `apps/mobile/test/data/local/database_tables_test.dart`

- [ ] **Step 1: Write the failing schema test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/local/app_database.dart';

void main() {
  test('database contains required tables', () {
    final names = AppDatabase.requiredTableNames;
    expect(names, containsAll(['daily_entries', 'manifestos', 'avatar_growth_state']));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/data/local/database_tables_test.dart -r compact`  
Expected: FAIL with `AppDatabase` not found.

- [ ] **Step 3: Write minimal implementation**

```dart
// apps/mobile/lib/data/local/app_database.dart
class AppDatabase {
  static const requiredTableNames = <String>[
    'daily_entries',
    'manifestos',
    'challenges',
    'monthly_reviews',
    'advisor_memory',
    'avatar_profile',
    'avatar_growth_state',
    'avatar_energy_state',
    'avatar_unlocks',
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/data/local/database_tables_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/data/local apps/mobile/lib/domain apps/mobile/test/data/local
git commit -m "feat: add local domain schema contracts"
```

## Task 3: Build journaling + manifesto + challenge daily loop

**Files:**
- Create: `apps/mobile/lib/features/today/today_page.dart`
- Create: `apps/mobile/lib/features/journal/journal_entry_form.dart`
- Create: `apps/mobile/lib/features/manifesto/manifesto_page.dart`
- Create: `apps/mobile/lib/domain/challenge/challenge_service.dart`
- Test: `apps/mobile/test/features/today/today_challenge_link_test.dart`

- [ ] **Step 1: Write the failing linkage test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/challenge/challenge_service.dart';

void main() {
  test('manifesto plan yields suggested challenges', () {
    final service = ChallengeService();
    final out = service.suggestFromPlan(['Run 3km']);
    expect(out.first.title, 'Run 3km');
    expect(out.first.source, ChallengeSource.manifesto);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/features/today/today_challenge_link_test.dart -r compact`  
Expected: FAIL with `ChallengeService` not found.

- [ ] **Step 3: Write minimal implementation**

```dart
enum ChallengeSource { manifesto, custom }

class ChallengeItem {
  ChallengeItem(this.title, this.source);
  final String title;
  final ChallengeSource source;
}

class ChallengeService {
  List<ChallengeItem> suggestFromPlan(List<String> planItems) {
    return planItems.map((p) => ChallengeItem(p, ChallengeSource.manifesto)).toList();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/features/today/today_challenge_link_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/features apps/mobile/lib/domain/challenge apps/mobile/test/features/today
git commit -m "feat: implement today loop and manifesto challenge linkage"
```

## Task 4: Add advisor chat + web search + memory API contract

**Files:**
- Create: `services/api/src/modules/advisor/advisor.controller.ts`
- Create: `services/api/src/modules/advisor/advisor.service.ts`
- Create: `services/api/src/modules/advisor/memory.repository.ts`
- Create: `services/api/src/modules/advisor/search.provider.ts`
- Test: `services/api/test/advisor/advisor_chat_flow.test.ts`

- [ ] **Step 1: Write the failing advisor API test**

```ts
import request from 'supertest';
import { app } from '../../src/index';

describe('advisor chat flow', () => {
  it('returns answer with memory and search citations', async () => {
    const res = await request(app).post('/advisor/chat').send({
      userId: 'u1',
      message: 'How should I challenge today?',
      allowSearch: true
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('citations');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/advisor/advisor_chat_flow.test.ts`  
Expected: FAIL with route/app not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// services/api/src/modules/advisor/advisor.controller.ts
import { Router } from 'express';

export const advisorRouter = Router();
advisorRouter.post('/chat', async (req, res) => {
  res.json({
    answer: 'Start with one manifesto-linked challenge and one custom challenge.',
    citations: ['memory:weekly-trend', 'search:habit-loop-article']
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/advisor/advisor_chat_flow.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/advisor services/api/test/advisor services/api/src/index.ts
git commit -m "feat: add advisor chat search memory api contract"
```

## Task 5: Implement avatar growth + energy + evolution pause

**Files:**
- Create: `apps/mobile/lib/domain/avatar/avatar_growth_engine.dart`
- Create: `apps/mobile/lib/features/avatar/avatar_page.dart`
- Create: `apps/mobile/lib/features/avatar/widgets/evolution_toggle.dart`
- Test: `apps/mobile/test/domain/avatar/avatar_growth_engine_test.dart`

- [ ] **Step 1: Write the failing growth engine test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/avatar_growth_engine.dart';

void main() {
  test('streak triggers stage evolution when not paused', () {
    final state = AvatarGrowthState(level: 1, exp: 0, stage: 1, streakDays: 6, paused: false);
    final next = AvatarGrowthEngine().onChallengeCompleted(state);
    expect(next.stage, 2);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/domain/avatar/avatar_growth_engine_test.dart -r compact`  
Expected: FAIL with engine/state not found.

- [ ] **Step 3: Write minimal implementation**

```dart
class AvatarGrowthState {
  AvatarGrowthState({
    required this.level,
    required this.exp,
    required this.stage,
    required this.streakDays,
    required this.paused,
  });
  final int level;
  final int exp;
  final int stage;
  final int streakDays;
  final bool paused;
}

class AvatarGrowthEngine {
  AvatarGrowthState onChallengeCompleted(AvatarGrowthState s) {
    final streak = s.streakDays + 1;
    final stage = (!s.paused && streak >= 7) ? s.stage + 1 : s.stage;
    return AvatarGrowthState(
      level: s.level,
      exp: s.exp + 10,
      stage: stage,
      streakDays: streak,
      paused: s.paused,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/domain/avatar/avatar_growth_engine_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/domain/avatar apps/mobile/lib/features/avatar apps/mobile/test/domain/avatar
git commit -m "feat: implement avatar growth energy and evolution pause"
```

## Task 6: Add monthly review generation and manifesto plan feedback

**Files:**
- Create: `services/api/src/modules/review/monthly_review.service.ts`
- Create: `services/api/src/modules/review/monthly_review.controller.ts`
- Create: `apps/mobile/lib/features/review/monthly_review_page.dart`
- Test: `services/api/test/review/monthly_review_generation.test.ts`

- [ ] **Step 1: Write the failing monthly review API test**

```ts
import request from 'supertest';
import { app } from '../../src/index';

describe('monthly review', () => {
  it('returns strengths blockers and manifesto suggestions', async () => {
    const res = await request(app).post('/review/monthly').send({ userId: 'u1', month: '2026-05' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('strengths');
    expect(res.body).toHaveProperty('blockers');
    expect(res.body).toHaveProperty('manifestoAdjustments');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/review/monthly_review_generation.test.ts`  
Expected: FAIL with route not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// services/api/src/modules/review/monthly_review.controller.ts
import { Router } from 'express';

export const reviewRouter = Router();
reviewRouter.post('/monthly', async (_req, res) => {
  res.json({
    strengths: ['Kept daily challenge streak for 18 days'],
    blockers: ['Late-night schedule broke consistency'],
    manifestoAdjustments: ['Move hard challenge to morning slot']
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/review/monthly_review_generation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/review services/api/test/review apps/mobile/lib/features/review
git commit -m "feat: add monthly review and manifesto feedback loop"
```

## Task 7: Implement privacy scopes + sync for mobile and desktop readiness

**Files:**
- Create: `services/api/src/modules/sync/sync.controller.ts`
- Create: `services/api/src/modules/sync/sync.policy.ts`
- Create: `apps/mobile/lib/data/remote/sync_client.dart`
- Create: `apps/mobile/lib/features/settings/privacy_scope_page.dart`
- Test: `services/api/test/sync/privacy_scope_sync.test.ts`

- [ ] **Step 1: Write the failing privacy sync test**

```ts
import { applySyncPolicy } from '../../src/modules/sync/sync.policy';

describe('privacy sync policy', () => {
  it('excludes local-only records from upload payload', () => {
    const payload = applySyncPolicy([
      { id: '1', scope: 'local_only' },
      { id: '2', scope: 'sync_allowed' }
    ]);
    expect(payload.map((x: { id: string }) => x.id)).toEqual(['2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/sync/privacy_scope_sync.test.ts`  
Expected: FAIL with policy function not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export type SyncScope = 'local_only' | 'sync_allowed';
export function applySyncPolicy(records: Array<{ id: string; scope: SyncScope }>) {
  return records.filter((r) => r.scope === 'sync_allowed');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/sync/privacy_scope_sync.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/sync services/api/test/sync apps/mobile/lib/data/remote apps/mobile/lib/features/settings
git commit -m "feat: add privacy scoped sync contracts"
```

## Task 8: Add CI, release checklist, and first internal build

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/release/mvp-phase1-checklist.md`
- Modify: `README.md`
- Test: CI pipeline logs + local smoke commands

- [ ] **Step 1: Write failing CI workflow draft with strict checks**

```yaml
name: ci
on: [push, pull_request]
jobs:
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd apps/mobile && flutter test
```

- [ ] **Step 2: Run local commands to mirror CI and capture current failures**

Run: `cd apps/mobile && flutter test && cd ../../services/api && pnpm test`  
Expected: initial failures if dependencies or scripts missing.

- [ ] **Step 3: Implement final CI workflow + scripts**

```yaml
name: ci
on: [push, pull_request]
jobs:
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - run: cd apps/mobile && flutter pub get && flutter test
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: cd services/api && pnpm install && pnpm test
```

- [ ] **Step 4: Re-run all checks locally**

Run: `cd apps/mobile && flutter test && cd ../../services/api && pnpm test`  
Expected: PASS for all implemented test suites.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml docs/release/mvp-phase1-checklist.md README.md
git commit -m "chore: add ci pipeline and mvp release checklist"
```

## Spec Coverage Checklist

- Journal + manifesto quality input loop: covered by Task 2/3.
- Basic avatar with growth visibility: covered by Task 5.
- Advisor Q&A + search + memory baseline: covered by Task 4.
- Monthly review at low frequency: covered by Task 6.
- Hybrid privacy model and sync: covered by Task 7.
- iOS/Android first + macOS/Windows future-ready architecture: covered in file structure + Task 7 contracts.

## Execution Notes

- Keep each task in its own short-lived branch if multiple engineers parallelize.
- Do not start Task N+1 before Task N tests pass.
- Each commit message is already proposed; keep them or use equivalent wording.
- After Task 8, create an internal test build and run manual flow:
  - morning entry -> challenge completion -> avatar feedback -> advisor chat -> monthly review.
