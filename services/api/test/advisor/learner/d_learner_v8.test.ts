import { learnV8MaxTurns } from '../../../src/modules/advisor/learner/sub_learners/v8_max_turns';

describe('V8 maxTurns learner', () => {
  it('outputs max_turns = clamp(P95, 2, 5)', () => {
    // turns mostly 3, a few 4 -> P95 ~ 4
    const actualTurns = [...Array(18).fill(3), 4, 4];
    const policy = learnV8MaxTurns(actualTurns);
    expect(policy?.actions.max_turns).toBe(4);
  });

  it('clamps high P95 down to 5', () => {
    const actualTurns = Array.from({ length: 20 }, () => 9);
    const policy = learnV8MaxTurns(actualTurns);
    expect(policy?.actions.max_turns).toBe(5);
  });

  it('clamps low P95 up to 2', () => {
    const actualTurns = Array.from({ length: 20 }, () => 1);
    const policy = learnV8MaxTurns(actualTurns);
    expect(policy?.actions.max_turns).toBe(2);
  });

  it('returns null for insufficient samples', () => {
    expect(learnV8MaxTurns([3, 3])).toBeNull();
  });
});
