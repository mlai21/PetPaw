import { ExecutionStep, PlanTask } from './types';

export function buildResponderUserPayload(params: {
  userMessage: string;
  tasks: PlanTask[];
  executorSteps: ExecutionStep[];
  executorNotes: string[];
}): string {
  const taskLines = params.tasks.map(
    (task) => `${task.id}|${task.title}|needSearch=${task.needSearch}`,
  );
  const stepLines = params.executorSteps.map(
    (step) =>
      `${step.taskId}|${step.tool}|${step.status}|${step.outputSummary}`,
  );
  const notes = params.executorNotes.length
    ? params.executorNotes.join('; ')
    : 'none';

  return [
    `用户问题: ${params.userMessage}`,
    'Planner任务:',
    ...taskLines,
    'Executor执行结果:',
    ...stepLines,
    `Executor备注: ${notes}`,
    '请严格基于以上信息给出最终回答。',
  ].join('\n');
}
