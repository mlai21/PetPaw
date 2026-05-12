import { MemoryRepository } from './memory.repository';
import { SearchProvider } from './search.provider';
import { runExecutor } from './agent_loop/executor.agent';
import { plannerPromptFile } from './agent_loop/planner.prompt';
import { runPlanner } from './agent_loop/planner.agent';
import { toolRegistryFile } from './agent_loop/tool.registry';
import { ExecutionStep, PlanTask } from './agent_loop/types';

type ChatInput = {
  userId: string;
  message: string;
  allowSearch: boolean;
};

export type AdvisorChatMeta = {
  /** 实际请求下游时使用的 model 名（未走 LLM 时为 n/a） */
  model: string;
  /** dashscope | openai | none */
  route: 'dashscope' | 'openai' | 'none';
  /** 是否成功用 LLM 生成 answer（否＝ stub 或错误回落） */
  llmOk: boolean;
};

type ChatOutput = {
  answer: string;
  citations: string[];
  meta: AdvisorChatMeta;
  trace: {
    plannerPromptFile: string;
    toolRegistryFile: string;
    tasks: PlanTask[];
    executorSteps: ExecutionStep[];
  };
};

const stubAnswer =
  'Start with one manifesto-linked challenge and one custom challenge.';

const defaultDashscopeBaseUrl =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

const defaultOpenAiBaseUrl = 'https://api.openai.com/v1';

export class AdvisorService {
  constructor(
    private readonly memoryRepository = new MemoryRepository(),
    private readonly searchProvider = new SearchProvider(),
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const trend = this.memoryRepository.getWeeklyTrend(input.userId);
    const searchResult = input.allowSearch
      ? this.searchProvider.getHabitLoopArticle(input.message)
      : 'search-disabled';

    const citations = [`memory:${trend}`, `search:${searchResult}`];
    const defaultTrace = {
      plannerPromptFile,
      toolRegistryFile,
      tasks: [] as PlanTask[],
      executorSteps: [] as ExecutionStep[],
    };

    const dashKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (dashKey) {
      const baseUrl =
        process.env.DASHSCOPE_COMPAT_BASE_URL?.trim() ||
        defaultDashscopeBaseUrl;
      const model =
        process.env.DASHSCOPE_MODEL?.trim() || 'qwen3.5-flash';
      try {
        const planner = await runPlanner({
          baseUrl,
          apiKey: dashKey,
          model,
          userMessage: input.message,
          weeklyTrend: trend,
        });
        console.log(
          '[advisor][planner][dashscope]',
          JSON.stringify(planner.tasks),
        );
        const executor = await runExecutor({
          tasks: planner.tasks,
          allowSearch: input.allowSearch,
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.message,
        });
        console.log(
          '[advisor][executor][dashscope]',
          JSON.stringify(executor.steps),
        );
        const answer = planner.answerDraft;
        return {
          answer,
          citations: [...citations, 'provider:bailian-qwen-compatible'],
          meta: {
            model,
            route: 'dashscope',
            llmOk: true,
          },
          trace: {
            plannerPromptFile,
            toolRegistryFile,
            tasks: planner.tasks,
            executorSteps: executor.steps,
          },
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'dashscope_unknown';
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
        const planner = await runPlanner({
          baseUrl,
          apiKey: openaiKey,
          model,
          userMessage: input.message,
          weeklyTrend: trend,
        });
        console.log(
          '[advisor][planner][openai]',
          JSON.stringify(planner.tasks),
        );
        const executor = await runExecutor({
          tasks: planner.tasks,
          allowSearch: input.allowSearch,
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.message,
        });
        console.log(
          '[advisor][executor][openai]',
          JSON.stringify(executor.steps),
        );
        const answer = planner.answerDraft;
        return {
          answer,
          citations: [...citations, 'provider:openai-compatible'],
          meta: {
            model,
            route: 'openai',
            llmOk: true,
          },
          trace: {
            plannerPromptFile,
            toolRegistryFile,
            tasks: planner.tasks,
            executorSteps: executor.steps,
          },
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'openai_unknown';
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
