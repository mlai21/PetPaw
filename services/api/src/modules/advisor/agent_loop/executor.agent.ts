import { runBailianSearch } from './bailian.tool';
import { AdvisorCheckpoint, ExecutorOutput, PlanTask } from './types';
import { runTavilySearch } from './tavily.tool';
import { runXSearch } from './x.tool';

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label}_timeout_${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function hasUsableSearchContent(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized || normalized === 'no-search-results') {
    return false;
  }
  // Require at least one plausible http(s) URL to treat as usable web evidence.
  const matchedUrls = normalized.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (matchedUrls.length === 0) {
    return false;
  }
  const nonExampleUrls = matchedUrls.filter(
    (url) => !url.includes('https://example.com/'),
  );
  if (nonExampleUrls.length === 0) {
    return false;
  }
  return true;
}

type SearchCandidateResult = {
  tool: ExecutorOutput['steps'][number]['tool'];
  status: 'ok' | 'empty' | 'failed';
  outputSummary?: string;
  reasonSummary?: string;
  note: string;
};

async function runBailianCandidate(params: {
  query: string;
  taskId: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs: number;
}): Promise<SearchCandidateResult> {
  try {
    const snippet = await withTimeout(
      runBailianSearch({
        query: params.query,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        model: params.model,
        maxResults: 3,
      }),
      params.timeoutMs,
      'bailian',
    );
    if (hasUsableSearchContent(snippet)) {
      return {
        tool: 'bailian-search',
        status: 'ok',
        outputSummary: snippet,
        note: `bailian_ok:${params.taskId}`,
      };
    }
    return {
      tool: 'bailian-search',
      status: 'empty',
      reasonSummary: 'bailian_no_usable_results',
      note: `bailian_empty:${params.taskId}`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown-error';
    return {
      tool: 'bailian-search',
      status: 'failed',
      reasonSummary: reason,
      note: `bailian_failed:${params.taskId}:${reason}`,
    };
  }
}

async function runTavilyCandidate(params: {
  query: string;
  taskId: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<SearchCandidateResult> {
  try {
    const snippet = await withTimeout(
      runTavilySearch({
        query: params.query,
        apiKey: params.apiKey,
        maxResults: 3,
      }),
      params.timeoutMs,
      'tavily',
    );
    if (hasUsableSearchContent(snippet)) {
      return {
        tool: 'tavily-search',
        status: 'ok',
        outputSummary: snippet,
        note: `tavily_ok:${params.taskId}`,
      };
    }
    return {
      tool: 'tavily-search',
      status: 'empty',
      reasonSummary: 'tavily_no_usable_results',
      note: `tavily_empty:${params.taskId}`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown-error';
    return {
      tool: 'tavily-search',
      status: 'failed',
      reasonSummary: reason,
      note: `tavily_failed:${params.taskId}:${reason}`,
    };
  }
}

export async function runExecutor(params: {
  tasks: PlanTask[];
  allowSearch: boolean;
  dashscopeApiKey?: string;
  dashscopeCompatBaseUrl?: string;
  dashscopeModel?: string;
  xBearerToken?: string;
  tavilyApiKey?: string;
  originalMessage: string;
  searchToolTimeoutMs?: number;
  checkpoint?: AdvisorCheckpoint;
}): Promise<ExecutorOutput> {
  const steps: ExecutorOutput['steps'] = [];
  const notes: string[] = [];
  const searchToolTimeoutMs = Math.max(params.searchToolTimeoutMs ?? 12000, 1000);
  const completedFromCheckpoint = new Set(
    params.checkpoint?.completedTaskIds ?? [],
  );

  for (const task of params.tasks) {
    if (completedFromCheckpoint.has(task.id)) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'skipped',
        tool: 'none',
        inputSummary: 'checkpoint-skip',
        outputSummary: '已从 checkpoint 跳过',
      });
      continue;
    }

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

    let outputSummary = '';
    let selectedTool: ExecutorOutput['steps'][number]['tool'] = 'none';
    let searchDone = false;
    let reasonSummary = 'unknown-search-failure';

    const primaryCandidates: Array<Promise<SearchCandidateResult>> = [];
    if (params.dashscopeApiKey) {
      primaryCandidates.push(
        runBailianCandidate({
          query: params.originalMessage,
          taskId: task.id,
          apiKey: params.dashscopeApiKey,
          baseUrl: params.dashscopeCompatBaseUrl,
          model: params.dashscopeModel,
          timeoutMs: searchToolTimeoutMs,
        }),
      );
    }
    if (params.tavilyApiKey) {
      primaryCandidates.push(
        runTavilyCandidate({
          query: params.originalMessage,
          taskId: task.id,
          apiKey: params.tavilyApiKey,
          timeoutMs: searchToolTimeoutMs,
        }),
      );
    }

    const pendingPrimary = [...primaryCandidates];
    while (!searchDone && pendingPrimary.length > 0) {
      const raced = await Promise.race(
        pendingPrimary.map((candidate, index) =>
          candidate.then((result) => ({ index, result })),
        ),
      );
      pendingPrimary.splice(raced.index, 1);
      selectedTool = raced.result.tool;
      notes.push(raced.result.note);
      if (raced.result.status === 'ok') {
        searchDone = true;
        outputSummary = raced.result.outputSummary ?? '';
        break;
      }
      reasonSummary = raced.result.reasonSummary ?? 'search_candidate_not_usable';
    }

    if (!searchDone && params.xBearerToken) {
      try {
        const snippet = await withTimeout(
          runXSearch({
            query: `${params.originalMessage} lang:zh -is:retweet`,
            bearerToken: params.xBearerToken,
            maxResults: 10,
          }),
          searchToolTimeoutMs,
          'x_search',
        );
        if (hasUsableSearchContent(snippet)) {
          selectedTool = 'x-search';
          searchDone = true;
          outputSummary = snippet;
          notes.push(`x_ok:${task.id}`);
        } else {
          selectedTool = 'x-search';
          reasonSummary = 'x_no_usable_results';
          notes.push(`x_empty:${task.id}`);
        }
      } catch (error) {
        selectedTool = 'x-search';
        const reason = error instanceof Error ? error.message : 'unknown-error';
        notes.push(`x_failed:${task.id}:${reason}`);
        reasonSummary = reason;
      }
    }

    if (searchDone) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'done',
        tool: selectedTool,
        inputSummary: params.originalMessage,
        outputSummary,
      });
      continue;
    }

    if (!params.dashscopeApiKey && !params.xBearerToken && !params.tavilyApiKey) {
      steps.push({
        taskId: task.id,
        title: task.title,
        status: 'skipped',
        tool: 'none',
        inputSummary: params.originalMessage,
        outputSummary: '缺少搜索工具密钥，跳过搜索',
      });
      notes.push('all_search_skipped_no_key');
      continue;
    }

    steps.push({
      taskId: task.id,
      title: task.title,
      status: 'failed',
      tool: selectedTool,
      inputSummary: params.originalMessage,
      outputSummary: reasonSummary.slice(0, 220),
    });
  }

  const completedTaskIds = [
    ...new Set([
      ...(params.checkpoint?.completedTaskIds ?? []),
      ...steps
          .filter((step) => step.status === 'done' || step.status === 'skipped')
          .map((step) => step.taskId),
    ]),
  ];
  const lastFailedStep = [...steps].reverse().find((step) => step.status === 'failed');

  return {
    steps,
    notes,
    checkpoint: {
      version: 1,
      completedTaskIds,
      lastFailedTaskId: lastFailedStep?.taskId,
      updatedAt: new Date().toISOString(),
    },
  };
}
