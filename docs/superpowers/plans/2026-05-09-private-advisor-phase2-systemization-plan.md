# Private Advisor Phase 2 Systemization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持 Phase 1 稳定可用的前提下，完成二期“分身玩法系统化 + 记忆质量增强 + 桌面端演进准备”的第一轮可交付能力。

**Architecture:** 采用“配置驱动状态机 + 质量权重事件流 + 双端共享领域契约”方案。移动端继续承载主交互，API 负责记忆摘要与建议编排，新增的分身玩法与记忆策略通过明确接口隔离，确保后续可平滑扩展到 Flutter Desktop。所有新增行为均以 TDD 落地，并优先保证可回归与可观测。

**Tech Stack:** Flutter + Riverpod + Drift（客户端），Node/Express + TypeScript + Jest（服务端），GitHub Actions（CI）。

---

## File Structure (phase 2 additions)

- Create: `apps/mobile/lib/domain/avatar/evolution_rules.dart`
- Create: `apps/mobile/lib/domain/avatar/quality_weighted_growth.dart`
- Create: `apps/mobile/lib/domain/avatar/personality_mode.dart`
- Create: `apps/mobile/lib/features/avatar/widgets/personality_selector.dart`
- Create: `apps/mobile/lib/platform/desktop/desktop_capability.dart`
- Create: `apps/mobile/test/domain/avatar/evolution_rules_test.dart`
- Create: `apps/mobile/test/domain/avatar/quality_weighted_growth_test.dart`
- Create: `apps/mobile/test/domain/avatar/personality_mode_test.dart`
- Create: `services/api/src/modules/advisor/memory_summary.service.ts`
- Create: `services/api/src/modules/advisor/memory_summary.types.ts`
- Create: `services/api/src/modules/review/monthly_quality_insight.service.ts`
- Create: `services/api/test/advisor/memory_summary.test.ts`
- Create: `services/api/test/review/monthly_quality_insight.test.ts`
- Modify: `.github/workflows/ci.yml`（补充新增测试目标）
- Modify: `docs/release/mvp-phase1-checklist.md`（新增 phase2 内测检查项）

## Task 1: 配置驱动分身进化规则

**Files:**
- Create: `apps/mobile/lib/domain/avatar/evolution_rules.dart`
- Test: `apps/mobile/test/domain/avatar/evolution_rules_test.dart`

- [ ] **Step 1: Write the failing evolution rule test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/evolution_rules.dart';

void main() {
  test('evolution advances when streak and quality pass thresholds', () {
    final rules = EvolutionRules.defaultRules();
    final next = rules.nextStage(currentStage: 1, streakDays: 10, weeklyQualityScore: 82);
    expect(next, 2);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/domain/avatar/evolution_rules_test.dart -r compact`  
Expected: FAIL with `EvolutionRules` not found.

- [ ] **Step 3: Write minimal implementation**

```dart
class EvolutionRules {
  EvolutionRules({required this.streakThreshold, required this.qualityThreshold});

  final int streakThreshold;
  final int qualityThreshold;

  factory EvolutionRules.defaultRules() =>
      EvolutionRules(streakThreshold: 7, qualityThreshold: 75);

  int nextStage({
    required int currentStage,
    required int streakDays,
    required int weeklyQualityScore,
  }) {
    if (streakDays >= streakThreshold && weeklyQualityScore >= qualityThreshold) {
      return currentStage + 1;
    }
    return currentStage;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/domain/avatar/evolution_rules_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/domain/avatar/evolution_rules.dart apps/mobile/test/domain/avatar/evolution_rules_test.dart
git commit -m "feat: add config-driven avatar evolution rules"
```

## Task 2: 引入行动质量加权成长引擎

**Files:**
- Create: `apps/mobile/lib/domain/avatar/quality_weighted_growth.dart`
- Test: `apps/mobile/test/domain/avatar/quality_weighted_growth_test.dart`

- [ ] **Step 1: Write the failing weighted growth test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/quality_weighted_growth.dart';

void main() {
  test('high quality completion gains more exp than low quality', () {
    final engine = QualityWeightedGrowth();
    final high = engine.expGain(baseExp: 10, qualityScore: 90);
    final low = engine.expGain(baseExp: 10, qualityScore: 40);
    expect(high, greaterThan(low));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/domain/avatar/quality_weighted_growth_test.dart -r compact`  
Expected: FAIL with `QualityWeightedGrowth` not found.

- [ ] **Step 3: Write minimal implementation**

```dart
class QualityWeightedGrowth {
  int expGain({required int baseExp, required int qualityScore}) {
    if (qualityScore >= 85) return baseExp + 8;
    if (qualityScore >= 60) return baseExp + 3;
    return baseExp;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/domain/avatar/quality_weighted_growth_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/domain/avatar/quality_weighted_growth.dart apps/mobile/test/domain/avatar/quality_weighted_growth_test.dart
git commit -m "feat: add quality weighted growth engine"
```

## Task 3: 人格模式策略与 UI 选择器

**Files:**
- Create: `apps/mobile/lib/domain/avatar/personality_mode.dart`
- Create: `apps/mobile/lib/features/avatar/widgets/personality_selector.dart`
- Test: `apps/mobile/test/domain/avatar/personality_mode_test.dart`

- [ ] **Step 1: Write the failing personality strategy test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';

void main() {
  test('coach mode message is action-oriented', () {
    final text = PersonalityMode.coach.promptPrefix();
    expect(text, contains('行动'));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/domain/avatar/personality_mode_test.dart -r compact`  
Expected: FAIL with `PersonalityMode` not found.

- [ ] **Step 3: Write minimal implementation**

```dart
enum PersonalityMode { healer, coach, strategist }

extension PersonalityModePrompt on PersonalityMode {
  String promptPrefix() {
    switch (this) {
      case PersonalityMode.healer:
        return '以温和陪伴方式回应，优先稳定情绪';
      case PersonalityMode.coach:
        return '以行动导向方式回应，给出今天可执行的一步行动';
      case PersonalityMode.strategist:
        return '以军师方式回应，强调优先级和权衡';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && flutter test test/domain/avatar/personality_mode_test.dart -r compact`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/domain/avatar/personality_mode.dart apps/mobile/lib/features/avatar/widgets/personality_selector.dart apps/mobile/test/domain/avatar/personality_mode_test.dart
git commit -m "feat: add personality mode strategy contract"
```

## Task 4: 记忆摘要质量服务（服务端）

**Files:**
- Create: `services/api/src/modules/advisor/memory_summary.types.ts`
- Create: `services/api/src/modules/advisor/memory_summary.service.ts`
- Test: `services/api/test/advisor/memory_summary.test.ts`

- [ ] **Step 1: Write the failing memory summary test**

```ts
import { MemorySummaryService } from '../../src/modules/advisor/memory_summary.service';

describe('memory summary', () => {
  it('keeps actionable facts and drops private raw text', () => {
    const service = new MemorySummaryService();
    const out = service.summarize([
      { text: '我昨晚和家人争执很激烈', scope: 'local_only' },
      { text: '连续3天完成晨间挑战', scope: 'sync_allowed' }
    ]);
    expect(out.facts).toContain('连续3天完成晨间挑战');
    expect(out.facts.join(' ')).not.toContain('争执');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/advisor/memory_summary.test.ts`  
Expected: FAIL with service not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export class MemorySummaryService {
  summarize(records: Array<{ text: string; scope: 'local_only' | 'sync_allowed' }>) {
    const facts = records
      .filter((r) => r.scope === 'sync_allowed')
      .map((r) => r.text);
    return { facts };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/advisor/memory_summary.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/advisor/memory_summary.types.ts services/api/src/modules/advisor/memory_summary.service.ts services/api/test/advisor/memory_summary.test.ts
git commit -m "feat: add memory summary quality service"
```

## Task 5: 月度质量洞察服务（服务端）

**Files:**
- Create: `services/api/src/modules/review/monthly_quality_insight.service.ts`
- Test: `services/api/test/review/monthly_quality_insight.test.ts`

- [ ] **Step 1: Write the failing monthly quality test**

```ts
import { MonthlyQualityInsightService } from '../../src/modules/review/monthly_quality_insight.service';

describe('monthly quality insight', () => {
  it('returns quality trend and next-month focus', () => {
    const out = new MonthlyQualityInsightService().build([72, 80, 84, 78]);
    expect(out).toHaveProperty('qualityTrend');
    expect(out).toHaveProperty('nextMonthFocus');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && pnpm test test/review/monthly_quality_insight.test.ts`  
Expected: FAIL with service not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export class MonthlyQualityInsightService {
  build(weeklyScores: number[]) {
    const avg = Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length);
    return {
      qualityTrend: avg >= 75 ? 'upward' : 'flat',
      nextMonthFocus: avg >= 75 ? '保持高质量行动节奏' : '减少低质量连续中断',
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/api && pnpm test test/review/monthly_quality_insight.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/review/monthly_quality_insight.service.ts services/api/test/review/monthly_quality_insight.test.ts
git commit -m "feat: add monthly quality insight service"
```

## Task 6: 桌面端能力契约与 Phase 2 验收基线

**Files:**
- Create: `apps/mobile/lib/platform/desktop/desktop_capability.dart`
- Create: `apps/mobile/test/platform/desktop/desktop_capability_test.dart`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/release/mvp-phase1-checklist.md`

- [ ] **Step 1: Write the failing desktop capability test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/platform/desktop/desktop_capability.dart';

void main() {
  test('desktop capability reports feature flags', () {
    final caps = DesktopCapability.defaultCaps();
    expect(caps.supportsGlobalOverlay, false);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && flutter test test/platform/desktop/desktop_capability_test.dart -r compact`  
Expected: FAIL with capability class not found.

- [ ] **Step 3: Write minimal implementation**

```dart
class DesktopCapability {
  DesktopCapability({required this.supportsGlobalOverlay, required this.supportsTray});

  final bool supportsGlobalOverlay;
  final bool supportsTray;

  factory DesktopCapability.defaultCaps() =>
      DesktopCapability(supportsGlobalOverlay: false, supportsTray: false);
}
```

- [ ] **Step 4: Run full checks and update release checklist**

Run: `cd apps/mobile && flutter test && cd ../../services/api && pnpm test`  
Expected: PASS for all suites.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/platform/desktop/desktop_capability.dart .github/workflows/ci.yml docs/release/mvp-phase1-checklist.md
git commit -m "chore: add phase2 desktop readiness contracts and verification baseline"
```

## Spec Coverage Checklist

- 分身玩法系统化：Task 1/2/3 覆盖进化规则、质量成长、人格策略。
- 记忆质量增强：Task 4 覆盖摘要筛选与隐私边界。
- 月度洞察升级：Task 5 覆盖质量趋势与下月焦点输出。
- 桌面端演进预留：Task 6 覆盖桌面能力契约和持续集成验证。

## Execution Notes

- 所有任务按顺序执行，不跳过 RED→GREEN 验证。
- 每个任务最小提交，保持可审阅粒度。
- 若某任务出现跨端接口不一致，先补契约测试再改实现。
