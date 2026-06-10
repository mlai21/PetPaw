import { learnV6VerifySkip } from '../../../src/modules/advisor/learner/sub_learners/v6_verify_skip';

describe('V6 verify skip learner', () => {
  it('outputs skip_verify=true when rewrite rate < 5%', () => {
    // 40 samples, 1 changed = 2.5%
    const samples = Array.from({ length: 40 }, (_, i) => ({
      keywordCategory: 'tech',
      messageLengthBucket: 'short' as const,
      verifyChangedOutput: i === 0,
    }));
    const policies = learnV6VerifySkip(samples);
    const found = policies.find(
      (p) =>
        p.conditions.keyword_category === 'tech' &&
        p.conditions.message_length_bucket === 'short',
    );
    expect(found?.actions.skip_verify).toBe(true);
  });

  it('does not output skip when rewrite rate >= 5%', () => {
    // 20 samples, 4 changed = 20%
    const samples = Array.from({ length: 20 }, (_, i) => ({
      keywordCategory: 'weather',
      messageLengthBucket: 'medium' as const,
      verifyChangedOutput: i < 4,
    }));
    expect(learnV6VerifySkip(samples)).toEqual([]);
  });

  it('emits nothing for insufficient samples', () => {
    const samples = [
      {
        keywordCategory: 'weather',
        messageLengthBucket: 'short' as const,
        verifyChangedOutput: false,
      },
    ];
    expect(learnV6VerifySkip(samples)).toEqual([]);
  });
});
