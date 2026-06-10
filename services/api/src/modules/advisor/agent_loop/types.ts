export type PlanTask = {
  id: string;
  title: string;
  reason: string;
  needSearch: boolean;
};

export type AdvisorCheckpoint = {
  version: 1;
  completedTaskIds: string[];
  lastFailedTaskId?: string;
  updatedAt: string;
};

export type AgentLoopStatus =
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'aborted';

export type AgentLoopEventName =
  | 'loop_start'
  | 'loop_queued'
  | 'planner_start'
  | 'planner_done'
  | 'executor_start'
  | 'executor_done'
  | 'loop_end'
  // === E.1 新增 ===
  | 'runtime_start'
  | 'turn_start'
  | 'turn_complete'
  | 'task_start'
  | 'task_done'
  | 'task_failed'
  | 'task_skipped'
  | 'task_retried'
  | 'router_decision'
  | 'runtime_end';

export type AgentLoopEvent = {
  runId: string;
  event: AgentLoopEventName;
  stage: 'loop' | 'planner' | 'executor' | 'responder' | 'verify';
  status: AgentLoopStatus;
  taskIndex?: number;
  endState?: Extract<AgentLoopStatus, 'completed' | 'failed' | 'aborted'>;
  failureReason?: string;
  timestamp: string;
  detail?: string;
};

export type PlannerOutput = {
  tasks: PlanTask[];
  rawText: string;
  answerDraft: string;
};

export type ExecutionStep = {
  taskId: string;
  title: string;
  status: 'done' | 'skipped' | 'failed';
  tool: 'tavily-search' | 'x-search' | 'bailian-search' | 'none';
  inputSummary: string;
  outputSummary: string;
};

export type ExecutorOutput = {
  steps: ExecutionStep[];
  notes: string[];
  checkpoint: AdvisorCheckpoint;
};

export type ResponderOutput = {
  answer: string;
  rawText: string;
  userPayload: string;
};

export type VerifyOutput = {
  answer: string;
  rawText: string;
};
