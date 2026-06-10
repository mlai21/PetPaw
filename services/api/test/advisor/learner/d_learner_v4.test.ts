import { learnV4SearchTimeout } from '../../../src/modules/advisor/learner/sub_learners/v4_search_timeout';

describe('V4 search timeout learner', () => {
  it('outputs timeout_ms = ceilTo1000(P95 * 1.5) for a category', () => {
    // durations 100..2000ms step 100 (20 samples); P95 (nearest-rank) = 2000
    const samples = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'weather',
      toolDurationMs: (i + 1) * 100,
    }));
    const policies = learnV4SearchTimeout(samples);
    const weather = policies.find((p) => p.conditions.keyword_category === 'weather');
    // P95 = 2000, *1.5 = 3000, max(5000, 3000) = 5000, ceilTo1000 = 5000
    expect(weather?.actions.timeout_ms).toBe(5000);
  });

  it('floors the timeout at 5000ms', () => {
    const samples = Array.from({ length: 12 }, () => ({
      keywordCategory: 'tech',
      toolDurationMs: 200,
    }));
    const policies = learnV4SearchTimeout(samples);
    const tech = policies.find((p) => p.conditions.keyword_category === 'tech');
    expect(tech?.actions.timeout_ms).toBe(5000);
  });

  it('produces large timeout for slow categories, rounded up to 1000ms', () => {
    // all 8000ms -> P95=8000 *1.5=12000 -> 12000
    const samples = Array.from({ length: 12 }, () => ({
      keywordCategory: 'realtime_lookup',
      toolDurationMs: 8000,
    }));
    const policies = learnV4SearchTimeout(samples);
    const cat = policies.find((p) => p.conditions.keyword_category === 'realtime_lookup');
    expect(cat?.actions.timeout_ms).toBe(12000);
  });

  it('emits nothing for insufficient samples', () => {
    expect(learnV4SearchTimeout([{ keywordCategory: 'weather', toolDurationMs: 100 }])).toEqual([]);
  });
});
