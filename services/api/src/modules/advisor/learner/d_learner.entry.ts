import type { SessionStore } from '../persistence/session_store.types';
import { publishPolicy } from './policy_publisher';
import { learnV3ToolPriority, type V3Sample } from './sub_learners/v3_tool_priority';
import { learnV4SearchTimeout, type V4Sample } from './sub_learners/v4_search_timeout';
import { learnV8MaxTurns } from './sub_learners/v8_max_turns';

export type DLearnerOptions = {
  /** 训练窗口：只取最近 N 天的脱敏 trace。默认 7 天。 */
  lookbackDays?: number;
  /** 新策略默认灰度比例。默认 10%。 */
  rolloutPct?: number;
  now?: number;
};

/**
 * 离线 D-Learner 单次运行：扫描最近窗口内的脱敏 trace，跑各子学习器，
 * 把产出的策略写入 advisor_policies（默认 10% 灰度）。
 *
 * 当前编排覆盖 V3（工具优先级）/ V4（搜索超时）/ V8（maxTurns）——这三者可从
 * 现有 6 表 schema 忠实推导。V1/V5/V6 需要 schema 尚未持久化的信号
 * （usedHeavyPath / queryGranularity / verifyChangedOutput），待 schema 扩展后接入。
 */
export async function runDLearnerOnce(
  store: SessionStore,
  options: DLearnerOptions = {},
): Promise<{ publishedVersions: string[] }> {
  const lookbackDays = options.lookbackDays ?? 7;
  const rolloutPct = options.rolloutPct ?? 10;
  const now = options.now ?? Date.now();
  const sinceMs = now - lookbackDays * 86400000;

  const { runtimes, tasks } = await store.trainingData(sinceMs);
  const versions: string[] = [];

  // V3：按 keyword_category 统计各工具成功率
  const v3Samples: V3Sample[] = tasks
    .filter((t) => t.toolUsed && t.toolUsed !== 'none')
    .map((t) => ({
      keywordCategory: t.keywordCategory ?? null,
      toolUsed: t.toolUsed as V3Sample['toolUsed'],
      toolResult: (t.toolResult ?? 'empty') as V3Sample['toolResult'],
    }));
  for (const policy of learnV3ToolPriority(v3Samples)) {
    versions.push(
      await publishPolicy(store, {
        scope: policy.scope,
        conditions: policy.conditions,
        actions: policy.actions,
        rolloutPct,
      }),
    );
  }

  // V4：按 keyword_category 统计需搜索任务的耗时分布
  const v4Samples: V4Sample[] = tasks
    .filter((t) => t.needSearch)
    .map((t) => ({ keywordCategory: t.keywordCategory ?? null, toolDurationMs: t.durationMs }));
  for (const policy of learnV4SearchTimeout(v4Samples)) {
    versions.push(
      await publishPolicy(store, {
        scope: policy.scope,
        conditions: policy.conditions,
        actions: policy.actions,
        rolloutPct,
      }),
    );
  }

  // V8：全局 maxTurns，按 runtime 实际轮次的 P95
  const v8Policy = learnV8MaxTurns(runtimes.map((r) => r.totalTurns));
  if (v8Policy) {
    versions.push(
      await publishPolicy(store, {
        scope: v8Policy.scope,
        conditions: v8Policy.conditions,
        actions: v8Policy.actions,
        rolloutPct,
      }),
    );
  }

  return { publishedVersions: versions };
}
