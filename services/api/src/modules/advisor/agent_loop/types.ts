export type PlanTask = {
  id: string;
  title: string;
  reason: string;
  needSearch: boolean;
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
  tool: 'tavily-search' | 'none';
  inputSummary: string;
  outputSummary: string;
};

export type ExecutorOutput = {
  steps: ExecutionStep[];
  notes: string[];
};
