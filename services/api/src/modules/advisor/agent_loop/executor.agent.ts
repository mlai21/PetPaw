import { ExecutorOutput, PlanTask } from './types';
import { runTavilySearch } from './tavily.tool';

export async function runExecutor(params: {
  tasks: PlanTask[];
  allowSearch: boolean;
  tavilyApiKey?: string;
  originalMessage: string;
}): Promise<ExecutorOutput> {
  const steps: ExecutorOutput['steps'] = [];
  const notes: string[] = [];

  for (const task of params.tasks) {
    if (!task.needSearch || !params.allowSearch) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'done',
        tool: 'none',
        inputSummary: 'no-tool-input',
        outputSummary: '无需检索，直接进入建议生成',
      });
      continue;
    }

    if (!params.tavilyApiKey) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'skipped',
        tool: 'tavily-search',
        inputSummary: params.originalMessage,
        outputSummary: '缺少 TAVILY_API_KEY，跳过搜索',
      });
      notes.push('tavily_skipped_no_key');
      continue;
    }

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
      notes.push(`tavily_ok:${task.id}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown-error';
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'failed',
        tool: 'tavily-search',
        inputSummary: params.originalMessage,
        outputSummary: reason.slice(0, 220),
      });
      notes.push(`tavily_failed:${task.id}:${reason}`);
    }
  }

  return { steps, notes };
}
