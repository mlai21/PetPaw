import { AdvisorCheckpoint, ExecutorOutput, PlanTask } from './types';
import { runTavilySearch } from './tavily.tool';

function buildTaskQuery(task: PlanTask, originalMessage: string): string {
  const chunks = [task.title, task.reason, originalMessage]
    .map((part) => part.trim())
    .filter(Boolean);
  return chunks.join(' | ');
}

export async function runExecutor(params: {
  tasks: PlanTask[];
  allowSearch: boolean;
  tavilyApiKey?: string;
  originalMessage: string;
  checkpoint?: AdvisorCheckpoint;
}): Promise<ExecutorOutput> {
  const steps: ExecutorOutput['steps'] = [];
  const notes: string[] = [];
  const completedTaskIds = new Set(params.checkpoint?.completedTaskIds ?? []);
  let lastFailedTaskId: string | undefined;

  for (const task of params.tasks) {
    if (completedTaskIds.has(task.id)) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'skipped',
        tool: 'none',
        inputSummary: 'checkpoint-skip',
        outputSummary: '任务已在上次执行完成，本次续跑跳过',
      });
      notes.push(`checkpoint_skip:${task.id}`);
      continue;
    }

    const taskQuery = buildTaskQuery(task, params.originalMessage);
    if (!task.needSearch || !params.allowSearch) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'done',
        tool: 'none',
        inputSummary: 'no-tool-input',
        outputSummary: '无需检索，直接进入建议生成',
      });
      completedTaskIds.add(task.id);
      continue;
    }

    if (!params.tavilyApiKey) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'skipped',
        tool: 'tavily-search',
        inputSummary: taskQuery,
        outputSummary: '缺少 TAVILY_API_KEY，跳过搜索',
      });
      notes.push('tavily_skipped_no_key');
      continue;
    }

    try {
      const snippet = await runTavilySearch({
        query: taskQuery,
        apiKey: params.tavilyApiKey,
        maxResults: 3,
      });
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'done',
        tool: 'tavily-search',
        inputSummary: taskQuery,
        outputSummary: snippet.slice(0, 260),
      });
      completedTaskIds.add(task.id);
      notes.push(`tavily_ok:${task.id}`);
    } catch (error) {
      const firstReason =
        error instanceof Error ? error.message : 'unknown-error';
      try {
        const snippet = await runTavilySearch({
          query: params.originalMessage,
          apiKey: params.tavilyApiKey,
          maxResults: 3,
        });
        steps.push({
          taskId: task.id,
          title: task.title,
          status: 'done',
          tool: 'tavily-search',
          inputSummary: params.originalMessage,
          outputSummary: snippet.slice(0, 260),
        });
        completedTaskIds.add(task.id);
        notes.push(`tavily_fallback_original_message:${task.id}`);
      } catch (fallbackError) {
        const secondReason =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'unknown-error';
        steps.push({
          taskId: task.id,
          title: task.title,
          status: 'failed',
          tool: 'tavily-search',
          inputSummary: params.originalMessage,
          outputSummary: secondReason.slice(0, 220),
        });
        lastFailedTaskId = task.id;
        notes.push(
          `tavily_failed:${task.id}:${firstReason} -> fallback:${secondReason}`,
        );
      }
    }
  }

  return {
    steps,
    notes,
    checkpoint: {
      version: 1,
      completedTaskIds: [...completedTaskIds],
      lastFailedTaskId,
      updatedAt: new Date().toISOString(),
    },
  };
}
