import { MemoryRepository } from './memory.repository';
import { SearchProvider } from './search.provider';
import { runExecutor } from './agent_loop/executor.agent';
import { plannerPromptFile } from './agent_loop/planner.prompt';
import { runPlanner } from './agent_loop/planner.agent';
import { toolRegistryFile } from './agent_loop/tool.registry';
import {
  AgentLoopEvent,
  AgentLoopEventName,
  AgentLoopStatus,
  AdvisorCheckpoint,
  ExecutionStep,
  PlanTask,
} from './agent_loop/types';
import { randomUUID } from 'crypto';

type ChatInput = {
  userId: string;
  message: string;
  allowSearch: boolean;
  checkpoint?: AdvisorCheckpoint;
  runMode?: 'sync' | 'async';
};

export type AdvisorChatMeta = {
  /** 实际请求下游时使用的 model 名（未走 LLM 时为 n/a） */
  model: string;
  /** dashscope | openai | none */
  route: 'dashscope' | 'openai' | 'none';
  /** 是否成功用 LLM 生成 answer（否＝ stub 或错误回落） */
  llmOk: boolean;
};

type AdvisorChatTrace = {
  runId: string;
  events: AgentLoopEvent[];
  plannerPromptFile: string;
  toolRegistryFile: string;
  tasks: PlanTask[];
  executorSteps: ExecutionStep[];
  checkpoint: AdvisorCheckpoint;
  queueId?: string;
};

type AdvisorChatResult = {
  answer: string;
  citations: string[];
  meta: AdvisorChatMeta;
  trace: AdvisorChatTrace;
};

export type AdvisorQueueTaskStatus = {
  queueId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
  progress: number;
  resultPreview: string;
  result: AdvisorChatResult | null;
  updatedAt: string;
};

type ChatOutput = AdvisorChatResult;

const stubAnswer =
  'Start with one manifesto-linked challenge and one custom challenge.';
const queuedAnswer =
  '请求已进入后台队列（当前为异步模式骨架，后续将补充真实后台执行）。';

const defaultDashscopeBaseUrl =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

const defaultOpenAiBaseUrl = 'https://api.openai.com/v1';
const createEmptyCheckpoint = (): AdvisorCheckpoint => ({
  version: 1,
  completedTaskIds: [],
  updatedAt: new Date().toISOString(),
});

export class AdvisorService {
  private readonly asyncQueue = new Map<
    string,
    {
      status: 'queued' | 'running' | 'completed' | 'failed';
      updatedAt: string;
      pollCount: number;
      result: AdvisorQueueTaskStatus['result'];
      runId: string;
      citations: string[];
      checkpoint: AdvisorCheckpoint;
      previewAnswer: string;
    }
  >();

  constructor(
    private readonly memoryRepository = new MemoryRepository(),
    private readonly searchProvider = new SearchProvider(),
  ) {}

  getTaskStatus(queueId: string): AdvisorQueueTaskStatus {
    const record = this.asyncQueue.get(queueId);
    if (!record) {
      return {
        queueId,
        status: 'not_found',
        progress: 0,
        resultPreview: '',
        result: null,
        updatedAt: new Date().toISOString(),
      };
    }
    record.pollCount += 1;
    if (record.status === 'queued' && record.pollCount >= 2) {
      record.status = 'running';
      record.updatedAt = new Date().toISOString();
    } else if (record.status === 'running' && record.pollCount >= 3) {
      record.status = 'completed';
      record.updatedAt = new Date().toISOString();
      record.result = {
        answer: record.previewAnswer,
        citations: record.citations,
        meta: {
          model: 'n/a',
          route: 'none',
          llmOk: false,
        },
        trace: {
          runId: record.runId,
          events: [],
          plannerPromptFile,
          toolRegistryFile,
          tasks: [],
          executorSteps: [
            {
              taskId: 'async-simulated',
              title: 'simulate async completion',
              status: 'done',
              tool: 'none',
              inputSummary: 'polling-status',
              outputSummary: '模拟异步任务已完成',
            },
          ],
          checkpoint: {
            ...record.checkpoint,
            updatedAt: record.updatedAt,
          },
          queueId,
        },
      };
    }
    return {
      queueId,
      status: record.status,
      progress:
        record.status === 'queued'
          ? 0
          : record.status === 'running'
            ? 50
            : record.status === 'completed'
              ? 100
              : 0,
      resultPreview:
        record.status === 'completed'
          ? record.previewAnswer
          : '',
      result: record.result,
      updatedAt: record.updatedAt,
    };
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const runId = randomUUID();
    const events: AgentLoopEvent[] = [];
    const stageByEvent: Record<AgentLoopEventName, AgentLoopEvent['stage']> = {
      loop_start: 'loop',
      loop_queued: 'loop',
      planner_start: 'planner',
      planner_done: 'planner',
      executor_start: 'executor',
      executor_done: 'executor',
      loop_end: 'loop',
    };
    const pushEvent = (
      event: AgentLoopEventName,
      status: AgentLoopStatus,
      options?: {
        detail?: string;
        taskIndex?: number;
        endState?: Extract<AgentLoopStatus, 'completed' | 'failed' | 'aborted'>;
        failureReason?: string;
      },
    ) => {
      events.push({
        runId,
        event,
        stage: stageByEvent[event],
        status,
        taskIndex: options?.taskIndex,
        endState: options?.endState,
        failureReason: options?.failureReason,
        timestamp: new Date().toISOString(),
        detail: options?.detail,
      });
    };
    pushEvent('loop_start', 'running');

    const trend = this.memoryRepository.getWeeklyTrend(input.userId);
    const searchResult = input.allowSearch
      ? this.searchProvider.getHabitLoopArticle(input.message)
      : 'search-disabled';

    const citations = [`memory:${trend}`, `search:${searchResult}`];
    const defaultTrace = {
      runId,
      events,
      plannerPromptFile,
      toolRegistryFile,
      tasks: [] as PlanTask[],
      executorSteps: [] as ExecutionStep[],
      checkpoint: input.checkpoint ?? createEmptyCheckpoint(),
      queueId: undefined,
    };
    const isAsyncModeEnabled = process.env.ADVISOR_ENABLE_ASYNC_MODE === 'true';
    if (isAsyncModeEnabled && input.runMode === 'async') {
      const queueId = randomUUID();
      const queuedAt = new Date().toISOString();
      this.asyncQueue.set(queueId, {
        status: 'queued',
        updatedAt: queuedAt,
        pollCount: 0,
        result: null,
        runId,
        citations: [...citations, 'mode:async-simulated'],
        checkpoint: input.checkpoint ?? createEmptyCheckpoint(),
        previewAnswer: `异步任务模拟完成：已生成「${input.message.slice(0, 24)}」的建议摘要。`,
      });
      pushEvent('loop_queued', 'waiting', {
        detail: 'skeleton_async_queue_enabled',
      });
      pushEvent('loop_end', 'waiting', {
        detail: 'queued_for_background_execution',
      });
      return {
        answer: queuedAnswer,
        citations: [...citations, 'mode:async-queued'],
        meta: {
          model: 'n/a',
          route: 'none',
          llmOk: false,
        },
        trace: {
          ...defaultTrace,
          queueId,
        },
      };
    }

    const dashKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (dashKey) {
      const baseUrl =
        process.env.DASHSCOPE_COMPAT_BASE_URL?.trim() ||
        defaultDashscopeBaseUrl;
      const model =
        process.env.DASHSCOPE_MODEL?.trim() || 'qwen3.5-flash';
      try {
        pushEvent('planner_start', 'running');
        const planner = await runPlanner({
          baseUrl,
          apiKey: dashKey,
          model,
          userMessage: input.message,
          weeklyTrend: trend,
        });
        pushEvent('planner_done', 'running');
        console.log(
          '[advisor][planner][dashscope]',
          JSON.stringify(planner.tasks),
        );
        pushEvent('executor_start', 'running');
        const executor = await runExecutor({
          tasks: planner.tasks,
          allowSearch: input.allowSearch,
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.message,
          checkpoint: input.checkpoint,
        });
        pushEvent('executor_done', 'running');
        console.log(
          '[advisor][executor][dashscope]',
          JSON.stringify(executor.steps),
        );
        const answer = planner.answerDraft;
        pushEvent('loop_end', 'completed', { endState: 'completed' });
        return {
          answer,
          citations: [...citations, 'provider:bailian-qwen-compatible'],
          meta: {
            model,
            route: 'dashscope',
            llmOk: true,
          },
          trace: {
            runId,
            events,
            plannerPromptFile,
            toolRegistryFile,
            tasks: planner.tasks,
            executorSteps: executor.steps,
            checkpoint: executor.checkpoint,
          },
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'dashscope_unknown';
        pushEvent('loop_end', 'failed', {
          detail: reason,
          endState: 'failed',
          failureReason: reason,
        });
        console.warn('[advisor] DashScope 调用失败，已回退 stub:', reason);
        return {
          answer: stubAnswer,
          citations: [...citations, `bailian-error:${reason}`],
          meta: {
            model,
            route: 'dashscope',
            llmOk: false,
          },
          trace: defaultTrace,
        };
      }
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      const baseUrl =
        process.env.OPENAI_BASE_URL?.trim() || defaultOpenAiBaseUrl;
      const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
      try {
        pushEvent('planner_start', 'running');
        const planner = await runPlanner({
          baseUrl,
          apiKey: openaiKey,
          model,
          userMessage: input.message,
          weeklyTrend: trend,
        });
        pushEvent('planner_done', 'running');
        console.log(
          '[advisor][planner][openai]',
          JSON.stringify(planner.tasks),
        );
        pushEvent('executor_start', 'running');
        const executor = await runExecutor({
          tasks: planner.tasks,
          allowSearch: input.allowSearch,
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.message,
          checkpoint: input.checkpoint,
        });
        pushEvent('executor_done', 'running');
        console.log(
          '[advisor][executor][openai]',
          JSON.stringify(executor.steps),
        );
        const answer = planner.answerDraft;
        pushEvent('loop_end', 'completed', { endState: 'completed' });
        return {
          answer,
          citations: [...citations, 'provider:openai-compatible'],
          meta: {
            model,
            route: 'openai',
            llmOk: true,
          },
          trace: {
            runId,
            events,
            plannerPromptFile,
            toolRegistryFile,
            tasks: planner.tasks,
            executorSteps: executor.steps,
            checkpoint: executor.checkpoint,
          },
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'openai_unknown';
        pushEvent('loop_end', 'failed', {
          detail: reason,
          endState: 'failed',
          failureReason: reason,
        });
        console.warn('[advisor] OpenAI 兼容接口失败，已回退 stub:', reason);
        return {
          answer: stubAnswer,
          citations: [...citations, `openai-error:${reason}`],
          meta: {
            model,
            route: 'openai',
            llmOk: false,
          },
          trace: defaultTrace,
        };
      }
    }

    pushEvent('loop_end', 'completed', { endState: 'completed' });
    return {
      answer: stubAnswer,
      citations,
      meta: {
        model: 'n/a',
        route: 'none',
        llmOk: false,
      },
      trace: defaultTrace,
    };
  }
}
