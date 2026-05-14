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
  tool: 'tavily-search' | 'x-search' | 'bailian-search' | 'none';
  inputSummary: string;
  outputSummary: string;
};

export type ExecutorOutput = {
  steps: ExecutionStep[];
  notes: string[];
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
