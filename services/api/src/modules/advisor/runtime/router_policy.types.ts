import type { KeywordCategory } from './keyword_categories';

export type DecisionPoint =
  | 'routeIntent'
  | 'setSearchTimeout'
  | 'setMaxTurns';

export type RuntimeSignal = {
  messageLengthBucket: 'short' | 'medium' | 'long';
  keywordCategory: KeywordCategory | null;
  recentToolFailureRate: number;
  recentVerifyFailRate: number;
};

export type RouterDecisionInput<T> = {
  decisionPoint: DecisionPoint;
  signal: RuntimeSignal;
  defaults: { value: T };
  humanOverride?: { value: T; reason: string };
};

export type RouterDecision<T> =
  | { source: 'human_override'; value: T; reason: string }
  | { source: 'd_policy'; value: T; policyVersion: string }
  | { source: 'default'; value: T };

export type RouterPolicy = {
  decide<T>(input: RouterDecisionInput<T>): RouterDecision<T>;
  recordSignal(event: { toolResult?: 'success' | 'fail' | 'empty'; verifyOutcome?: 'pass' | 'fail' }): void;
  getStats(): RollingStats;
};

export type RollingStats = {
  toolFailureCount: number;
  toolTotalCount: number;
  verifyFailCount: number;
  verifyTotalCount: number;
};
