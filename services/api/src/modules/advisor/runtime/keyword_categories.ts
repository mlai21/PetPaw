export type KeywordCategory =
  | 'weather'
  | 'current_affairs'
  | 'tech'
  | 'explicit_search'
  | 'realtime_lookup';

type Rule = { keyword: string; category: KeywordCategory; weight: number };

const RULES: Rule[] = [
  { keyword: '天气', category: 'weather', weight: 1.0 },
  { keyword: '下雨', category: 'weather', weight: 1.0 },
  { keyword: '气温', category: 'weather', weight: 1.0 },
  { keyword: '降雨', category: 'weather', weight: 1.0 },
  { keyword: '今天', category: 'current_affairs', weight: 0.5 },
  { keyword: '访华', category: 'current_affairs', weight: 1.0 },
  { keyword: '访美', category: 'current_affairs', weight: 1.0 },
  { keyword: '新闻', category: 'current_affairs', weight: 1.0 },
  { keyword: 'react', category: 'tech', weight: 1.0 },
  { keyword: 'python', category: 'tech', weight: 1.0 },
  { keyword: '编程', category: 'tech', weight: 1.0 },
  { keyword: '搜索', category: 'explicit_search', weight: 1.5 },
  { keyword: '检索', category: 'explicit_search', weight: 1.5 },
  { keyword: '查询', category: 'explicit_search', weight: 1.0 },
  { keyword: '股价', category: 'realtime_lookup', weight: 1.5 },
  { keyword: '汇率', category: 'realtime_lookup', weight: 1.5 },
];

export function classifyKeywords(text: string): KeywordCategory | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  const sums = new Map<KeywordCategory, number>();
  for (const rule of RULES) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      sums.set(rule.category, (sums.get(rule.category) ?? 0) + rule.weight);
    }
  }
  if (sums.size === 0) return null;
  let bestCategory: KeywordCategory | null = null;
  let bestWeight = -Infinity;
  for (const [category, weight] of sums.entries()) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestCategory = category;
    }
  }
  return bestCategory;
}
