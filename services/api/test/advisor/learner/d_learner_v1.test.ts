import { learnV1Intent } from '../../../src/modules/advisor/learner/sub_learners/v1_intent';

describe('V1 intent learner', () => {
  it('outputs force_plan=true for category with usage rate > 80%', () => {
    const trainSet = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'weather',
      messageLengthBucket: 'short' as const,
      usedHeavyPath: i < 18, // 18/20 = 90%
    }));
    const policies = learnV1Intent(trainSet);
    const weatherShort = policies.find(
      (p) =>
        p.conditions.keyword_category === 'weather' &&
        p.conditions.message_length_bucket === 'short',
    );
    expect(weatherShort?.actions.force_plan).toBe(true);
  });

  it('outputs force_plan=false for category with usage rate < 30%', () => {
    const trainSet = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'tech',
      messageLengthBucket: 'short' as const,
      usedHeavyPath: i < 5, // 25%
    }));
    const policies = learnV1Intent(trainSet);
    const techShort = policies.find((p) => p.conditions.keyword_category === 'tech');
    expect(techShort?.actions.force_plan).toBe(false);
  });

  it('outputs nothing for categories with insufficient sample (< 50)', () => {
    const trainSet = [
      { keywordCategory: 'weather', messageLengthBucket: 'short' as const, usedHeavyPath: true },
    ];
    expect(learnV1Intent(trainSet)).toEqual([]);
  });

  it('outputs nothing for ambiguous mid-range usage (30%~80%)', () => {
    const trainSet = Array.from({ length: 60 }, (_, i) => ({
      keywordCategory: 'weather',
      messageLengthBucket: 'short' as const,
      usedHeavyPath: i < 30, // 50%
    }));
    expect(learnV1Intent(trainSet)).toEqual([]);
  });
});
