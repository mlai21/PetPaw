import type { ExecutionStep, PlanTask } from '../agent_loop/types';

export type NextAction =
  | { kind: 'continue' }
  | { kind: 'retry_task'; taskId: string }
  | { kind: 'replan'; reason: string }
  | { kind: 'abort'; reason: string }
  | { kind: 'done'; finalAnswer: string };

export type AgentTrace = {
  agentName: 'intent' | 'planner' | 'executor' | 'responder' | 'verify';
  durationMs: number;
  model: string;
  skipped: boolean;
  reason?: string;
  toolUsed?: ExecutionStep['tool'];
  toolResult?: 'success' | 'fail' | 'empty';
};

export type AgentResult<T> = {
  data: T;
  nextAction: NextAction;
  trace: AgentTrace;
};

export type IntentData = {
  needPlan: boolean;
  reason: string;
  directAnswer: string;
};

export type PlannerData = {
  tasks: PlanTask[];
  rawText: string;
  answerDraft: string;
};

export type ExecutorData = {
  steps: ExecutionStep[];
  notes: string[];
};

export type ResponderData = {
  answer: string;
  rawText: string;
  userPayload: string;
};

export type VerifyData = {
  answer: string;
  rawText: string;
  fallback: boolean;
};
