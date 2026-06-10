export type V1Sample = {
  keywordCategory: string | null;
  messageLengthBucket: 'short' | 'medium' | 'long';
  usedHeavyPath: boolean; // intent.needPlan=true 且结果被采纳
};

export type V1Policy = {
  scope: 'routeIntent';
  conditions: { keyword_category: string; message_length_bucket: string };
  actions: { force_plan: boolean };
};

// 注：spec §6.5 建议生产阈值更高，但计划提供的测试用例（每组 20 样本即期望输出）
// 要求该值 ≤ 20；取 10 以兼顾"有效样本下限"与计划测试。
const MIN_SAMPLES_PER_GROUP = 10;
const HIGH_THRESHOLD = 0.8;
const LOW_THRESHOLD = 0.3;

export function learnV1Intent(samples: V1Sample[]): V1Policy[] {
  const groups = new Map<string, V1Sample[]>();
  for (const s of samples) {
    if (!s.keywordCategory) continue;
    const key = `${s.keywordCategory}::${s.messageLengthBucket}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  const policies: V1Policy[] = [];
  for (const [key, list] of groups.entries()) {
    if (list.length < MIN_SAMPLES_PER_GROUP) continue;
    const [category, bucket] = key.split('::');
    const rate = list.filter((s) => s.usedHeavyPath).length / list.length;
    if (rate > HIGH_THRESHOLD) {
      policies.push({
        scope: 'routeIntent',
        conditions: { keyword_category: category, message_length_bucket: bucket },
        actions: { force_plan: true },
      });
    } else if (rate < LOW_THRESHOLD) {
      policies.push({
        scope: 'routeIntent',
        conditions: { keyword_category: category, message_length_bucket: bucket },
        actions: { force_plan: false },
      });
    }
  }
  return policies;
}
