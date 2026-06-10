import { learnV3ToolPriority } from '../../../src/modules/advisor/learner/sub_learners/v3_tool_priority';

describe('V3 tool priority learner', () => {
  it('orders tools by success rate descending for a category', () => {
    const samples = [
      // tavily: 9/10 success
      ...Array.from({ length: 10 }, (_, i) => ({
        keywordCategory: 'weather',
        toolUsed: 'tavily-search' as const,
        toolResult: (i < 9 ? 'success' : 'fail') as 'success' | 'fail',
      })),
      // bailian: 5/10 success
      ...Array.from({ length: 10 }, (_, i) => ({
        keywordCategory: 'weather',
        toolUsed: 'bailian-search' as const,
        toolResult: (i < 5 ? 'success' : 'fail') as 'success' | 'fail',
      })),
      // x: 2/10 success
      ...Array.from({ length: 10 }, (_, i) => ({
        keywordCategory: 'weather',
        toolUsed: 'x-search' as const,
        toolResult: (i < 2 ? 'success' : 'fail') as 'success' | 'fail',
      })),
    ];
    const policies = learnV3ToolPriority(samples);
    const weather = policies.find((p) => p.conditions.keyword_category === 'weather');
    expect(weather?.actions.tool_order).toEqual(['tavily', 'bailian', 'x']);
  });

  it('emits nothing for category with insufficient samples', () => {
    const samples = [
      { keywordCategory: 'tech', toolUsed: 'tavily-search' as const, toolResult: 'success' as const },
    ];
    expect(learnV3ToolPriority(samples)).toEqual([]);
  });

  it('ignores samples without keyword category', () => {
    const samples = Array.from({ length: 12 }, () => ({
      keywordCategory: null,
      toolUsed: 'tavily-search' as const,
      toolResult: 'success' as const,
    }));
    expect(learnV3ToolPriority(samples)).toEqual([]);
  });
});
