import {
  learnV5QueryGranularity,
  shouldExploreTaskLevel,
} from '../../../src/modules/advisor/learner/sub_learners/v5_query_granularity';

describe('V5 query granularity learner', () => {
  it('chooses task_level when significantly better than message_level', () => {
    const samples = [
      // task_level: 18/20 success = 90%
      ...Array.from({ length: 20 }, (_, i) => ({
        keywordCategory: 'current_affairs',
        queryGranularity: 'task_level' as const,
        taskOutcome: (i < 18 ? 'success' : 'fail') as 'success' | 'fail',
      })),
      // message_level: 10/20 success = 50%
      ...Array.from({ length: 20 }, (_, i) => ({
        keywordCategory: 'current_affairs',
        queryGranularity: 'message_level' as const,
        taskOutcome: (i < 10 ? 'success' : 'fail') as 'success' | 'fail',
      })),
    ];
    const policies = learnV5QueryGranularity(samples);
    const found = policies.find((p) => p.conditions.keyword_category === 'current_affairs');
    expect(found?.actions.query_granularity).toBe('task_level');
  });

  it('emits nothing when task_level is not significantly better', () => {
    const samples = [
      ...Array.from({ length: 20 }, (_, i) => ({
        keywordCategory: 'tech',
        queryGranularity: 'task_level' as const,
        taskOutcome: (i < 11 ? 'success' : 'fail') as 'success' | 'fail',
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        keywordCategory: 'tech',
        queryGranularity: 'message_level' as const,
        taskOutcome: (i < 10 ? 'success' : 'fail') as 'success' | 'fail',
      })),
    ];
    expect(learnV5QueryGranularity(samples)).toEqual([]);
  });

  it('emits nothing when either arm has insufficient samples', () => {
    const samples = [
      { keywordCategory: 'weather', queryGranularity: 'task_level' as const, taskOutcome: 'success' as const },
      { keywordCategory: 'weather', queryGranularity: 'message_level' as const, taskOutcome: 'fail' as const },
    ];
    expect(learnV5QueryGranularity(samples)).toEqual([]);
  });
});

describe('shouldExploreTaskLevel (5% exploration)', () => {
  it('is deterministic for the same sessionId', () => {
    expect(shouldExploreTaskLevel('sess-abc')).toBe(shouldExploreTaskLevel('sess-abc'));
  });

  it('selects roughly 5% of sessions', () => {
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      if (shouldExploreTaskLevel(`sess-${i}`)) hits++;
    }
    expect(hits).toBeGreaterThan(4);
    expect(hits).toBeLessThan(45);
  });
});
