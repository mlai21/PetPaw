import { percentile } from './_stats';

export type V8Policy = {
  scope: 'setMaxTurns';
  conditions: Record<string, never>;
  actions: { max_turns: number };
};

const MIN_SAMPLES = 10;
const MIN_TURNS = 2;
const MAX_TURNS = 5;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

export function learnV8MaxTurns(actualTurns: number[]): V8Policy | null {
  if (actualTurns.length < MIN_SAMPLES) return null;
  const p95 = percentile(actualTurns, 0.95);
  return {
    scope: 'setMaxTurns',
    conditions: {},
    actions: { max_turns: clamp(Math.round(p95), MIN_TURNS, MAX_TURNS) },
  };
}
