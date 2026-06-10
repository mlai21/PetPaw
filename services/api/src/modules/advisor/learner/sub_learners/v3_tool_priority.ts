export type ToolName = 'tavily-search' | 'bailian-search' | 'x-search' | 'none';

export type V3Sample = {
  keywordCategory: string | null;
  toolUsed: ToolName;
  toolResult: 'success' | 'fail' | 'empty';
};

export type V3Policy = {
  scope: 'selectToolOrder';
  conditions: { keyword_category: string };
  actions: { tool_order: string[] };
};

const MIN_SAMPLES_PER_GROUP = 10;
const MIN_SAMPLES_PER_TOOL = 3;

const TOOL_SHORT: Record<ToolName, string> = {
  'tavily-search': 'tavily',
  'bailian-search': 'bailian',
  'x-search': 'x',
  none: 'none',
};

export function learnV3ToolPriority(samples: V3Sample[]): V3Policy[] {
  const byCategory = new Map<string, V3Sample[]>();
  for (const s of samples) {
    if (!s.keywordCategory || s.toolUsed === 'none') continue;
    const list = byCategory.get(s.keywordCategory) ?? [];
    list.push(s);
    byCategory.set(s.keywordCategory, list);
  }

  const policies: V3Policy[] = [];
  for (const [category, list] of byCategory.entries()) {
    if (list.length < MIN_SAMPLES_PER_GROUP) continue;
    const byTool = new Map<ToolName, { success: number; total: number }>();
    for (const s of list) {
      const agg = byTool.get(s.toolUsed) ?? { success: 0, total: 0 };
      agg.total += 1;
      if (s.toolResult === 'success') agg.success += 1;
      byTool.set(s.toolUsed, agg);
    }
    const ranked = [...byTool.entries()]
      .filter(([, agg]) => agg.total >= MIN_SAMPLES_PER_TOOL)
      .map(([tool, agg]) => ({ tool, rate: agg.success / agg.total }))
      .sort((a, b) => b.rate - a.rate)
      .map((r) => TOOL_SHORT[r.tool]);
    if (ranked.length === 0) continue;
    policies.push({
      scope: 'selectToolOrder',
      conditions: { keyword_category: category },
      actions: { tool_order: ranked },
    });
  }
  return policies;
}
