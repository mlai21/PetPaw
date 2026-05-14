import { MemoryRepository } from './memory.repository';
import { SearchProvider } from './search.provider';
import { runExecutor } from './agent_loop/executor.agent';
import { runIntentGate } from './agent_loop/intent.agent';
import { intentPromptFile } from './agent_loop/intent.prompt';
import { plannerPromptFile } from './agent_loop/planner.prompt';
import { runPlanner } from './agent_loop/planner.agent';
import { runResponder } from './agent_loop/responder.agent';
import { toolRegistryFile } from './agent_loop/tool.registry';
import { runVerify } from './agent_loop/verify.agent';
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

type AdvisorWebLink = {
  taskId: string;
  tool: ExecutionStep['tool'];
  title: string;
  url: string;
};

type ChatOutput = {
  answer: string;
  citations: string[];
  meta: AdvisorChatMeta;
  trace: {
    intentPromptFile: string;
    intent: {
      needPlan: boolean;
      reason: string;
    };
    plannerPromptFile: string;
    toolRegistryFile: string;
    tasks: PlanTask[];
    executorSteps: ExecutionStep[];
    webLinks: AdvisorWebLink[];
    responderRawText?: string;
    verifyRawText?: string;
    timings: {
      totalMs: number;
      intent: {
        durationMs: number;
        model: string;
        skipped: boolean;
        reason?: string;
      };
      planner: {
        durationMs: number;
        model: string;
        skipped: boolean;
        reason?: string;
      };
      executor: {
        durationMs: number;
        model: string;
        skipped: boolean;
        reason?: string;
      };
      responder: {
        durationMs: number;
        model: string;
        skipped: boolean;
        reason?: string;
      };
      verify: {
        durationMs: number;
        model: string;
        skipped: boolean;
        reason?: string;
      };
    };
  };
};

const stubAnswer =
  'Start with one manifesto-linked challenge and one custom challenge.';

const defaultDashscopeBaseUrl =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

const defaultOpenAiBaseUrl = 'https://api.openai.com/v1';

function hasExplicitSearchIntent(message: string): boolean {
  const text = message.toLowerCase();
  return /搜索|检索|查询|最新|资料|权威|联网|实时|source|sources|evidence|research/.test(
    text,
  );
}

function hasRealtimeLookupIntent(message: string): boolean {
  const text = message.toLowerCase();
  return /天气|气温|温度|降雨|预报|空气质量|aqi|汇率|股价|油价|航班|路况/.test(
    text,
  );
}

function hasCurrentAffairsLookupIntent(message: string): boolean {
  const text = message.toLowerCase();
  return /今天|今日|刚刚|最新|最近|现在|目前|是否|是不是|真的吗|消息|新闻|辟谣|官宣|访华|访美|会见|达成|签署|发生了|是真的吗/.test(
    text,
  );
}

function isGreetingOnlyMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return /^(你好|您好|嗨|hi|hello|早上好|中午好|下午好|晚上好|在吗|在么|哈喽|yo)[!！?？~～\s]*$/.test(
    normalized,
  );
}

function ensureSearchTaskWhenNeeded(params: {
  tasks: PlanTask[];
  allowSearch: boolean;
  userMessage: string;
}): PlanTask[] {
  const tasks = params.tasks.map((task) => ({ ...task }));
  if (tasks.length === 0) {
    return tasks;
  }
  if (
    !params.allowSearch ||
    (!hasRealtimeLookupIntent(params.userMessage) &&
      !hasExplicitSearchIntent(params.userMessage) &&
      !hasCurrentAffairsLookupIntent(params.userMessage))
  ) {
    return tasks;
  }
  if (tasks.some((task) => task.needSearch)) {
    return tasks;
  }
  const firstTask: PlanTask = {
    ...tasks[0],
    needSearch: true,
    reason: `${tasks[0].reason}（存在显式检索/实时信息需求，已强制开启检索）`,
  };
  tasks[0] = firstTask;
  return tasks;
}

function appendWebLinksToAnswer(answer: string, links: AdvisorWebLink[]): string {
  if (links.length === 0) {
    return answer;
  }
  if (links.some((link) => answer.includes(link.url))) {
    return answer;
  }
  const lines = links
    .slice(0, 5)
    .map((link) => `- ${link.title}: ${link.url}`);
  return `${answer.trim()}\n\n参考网页链接：\n${lines.join('\n')}`;
}

function extractWebLinksFromSteps(steps: ExecutionStep[]): AdvisorWebLink[] {
  const links: AdvisorWebLink[] = [];
  const seen = new Set<string>();
  const urlRegex = /https?:\/\/[^\s)]+/gi;

  for (const step of steps) {
    if (step.tool === 'none') {
      continue;
    }
    const lines = step.outputSummary.split('\n').map((line) => line.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const urls = line.match(urlRegex);
      if (!urls) {
        continue;
      }
      const title =
        i > 0 && lines[i - 1].length > 0
          ? lines[i - 1].replace(/^\d+\.\s*/, '').trim()
          : step.title;
      for (const rawUrl of urls) {
        const url = rawUrl.replace(/[.,;]$/, '');
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        links.push({
          taskId: step.taskId,
          tool: step.tool,
          title: title || step.title,
          url,
        });
      }
    }
  }

  return links;
}

function buildStageTiming(params: {
  durationMs: number;
  model: string;
  skipped?: boolean;
  reason?: string;
}): {
  durationMs: number;
  model: string;
  skipped: boolean;
  reason?: string;
} {
  return {
    durationMs: params.durationMs,
    model: params.model,
    skipped: params.skipped === true,
    reason: params.reason,
  };
}

function parseSlowRequestThresholdMs(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) {
    return 3000;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 3000;
  }
  return Math.floor(parsed);
}

function parseEnableThinking(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function parseSearchToolTimeoutMs(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) {
    return 12000;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12000;
  }
  return Math.floor(parsed);
}

function logSlowRequestIfNeeded(params: {
  route: 'dashscope' | 'openai';
  baseModel: string;
  forcePlanForSearch: boolean;
  thresholdMs: number;
  timings: {
    totalMs: number;
    intent: { durationMs: number; model: string };
    planner: { durationMs: number; model: string };
    executor: { durationMs: number; model: string };
    responder: { durationMs: number; model: string };
    verify: { durationMs: number; model: string; skipped: boolean; reason?: string };
  };
}): void {
  if (params.thresholdMs <= 0 || params.timings.totalMs < params.thresholdMs) {
    return;
  }
  const stageBreakdown = [
    {
      stage: 'intent',
      durationMs: params.timings.intent.durationMs,
      model: params.timings.intent.model,
    },
    {
      stage: 'planner',
      durationMs: params.timings.planner.durationMs,
      model: params.timings.planner.model,
    },
    {
      stage: 'executor',
      durationMs: params.timings.executor.durationMs,
      model: params.timings.executor.model,
    },
    {
      stage: 'responder',
      durationMs: params.timings.responder.durationMs,
      model: params.timings.responder.model,
    },
    {
      stage: 'verify',
      durationMs: params.timings.verify.durationMs,
      model: params.timings.verify.model,
      skipped: params.timings.verify.skipped,
      reason: params.timings.verify.reason,
    },
  ]
    .sort((a, b) => b.durationMs - a.durationMs)
    .map((item) => ({
      ...item,
      ratio:
        params.timings.totalMs > 0
          ? Number((item.durationMs / params.timings.totalMs).toFixed(3))
          : 0,
    }));
  console.warn(
    '[advisor][slow_request]',
    JSON.stringify({
      route: params.route,
      baseModel: params.baseModel,
      forcePlanForSearch: params.forcePlanForSearch,
      thresholdMs: params.thresholdMs,
      totalMs: params.timings.totalMs,
      topStages: stageBreakdown.slice(0, 3),
      stageBreakdown,
    }),
  );
}

function logSearchQualityFallbackIfNeeded(params: {
  route: 'dashscope' | 'openai';
  baseModel: string;
  userMessage: string;
  notes: string[];
}): void {
  if (params.notes.length === 0) {
    return;
  }
  const parseTaskId = (note: string): string | null => {
    const parts = note.split(':');
    if (parts.length < 2) {
      return null;
    }
    const id = parts[1]?.trim();
    return id && id.length > 0 ? id : null;
  };
  const bailianEmptyTaskIds = new Set<string>();
  const xOkTaskIds = new Set<string>();
  const tavilyOkTaskIds = new Set<string>();
  for (const note of params.notes) {
    if (note.startsWith('bailian_empty:')) {
      const taskId = parseTaskId(note);
      if (taskId) {
        bailianEmptyTaskIds.add(taskId);
      }
      continue;
    }
    if (note.startsWith('x_ok:')) {
      const taskId = parseTaskId(note);
      if (taskId) {
        xOkTaskIds.add(taskId);
      }
      continue;
    }
    if (note.startsWith('tavily_ok:')) {
      const taskId = parseTaskId(note);
      if (taskId) {
        tavilyOkTaskIds.add(taskId);
      }
    }
  }

  const fallbackTasks: Array<{
    taskId: string;
    recoveredBy: 'x-search' | 'tavily-search';
  }> = [];
  for (const taskId of bailianEmptyTaskIds) {
    if (xOkTaskIds.has(taskId)) {
      fallbackTasks.push({ taskId, recoveredBy: 'x-search' });
      continue;
    }
    if (tavilyOkTaskIds.has(taskId)) {
      fallbackTasks.push({ taskId, recoveredBy: 'tavily-search' });
    }
  }
  if (fallbackTasks.length === 0) {
    return;
  }

  console.warn(
    '[advisor][search_quality_fallback]',
    JSON.stringify({
      route: params.route,
      baseModel: params.baseModel,
      fallbackTaskCount: fallbackTasks.length,
      fallbackTasks,
      userMessage: params.userMessage.slice(0, 120),
    }),
  );
}

export class AdvisorService {
  constructor(
    private readonly memoryRepository = new MemoryRepository(),
    private readonly searchProvider = new SearchProvider(),
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const trend = this.memoryRepository.getWeeklyTrend(input.userId);
    const effectiveAllowSearch =
      input.allowSearch ||
      hasExplicitSearchIntent(input.message) ||
      hasRealtimeLookupIntent(input.message) ||
      hasCurrentAffairsLookupIntent(input.message);
    const searchResult = effectiveAllowSearch
      ? this.searchProvider.getHabitLoopArticle(input.message)
      : 'search-disabled';

    const citations = [`memory:${trend}`, `search:${searchResult}`];
    const defaultTrace = {
      intentPromptFile,
      intent: {
        needPlan: false,
        reason: 'not-evaluated',
      },
      plannerPromptFile,
      toolRegistryFile,
      tasks: [] as PlanTask[],
      executorSteps: [] as ExecutionStep[],
      webLinks: [] as AdvisorWebLink[],
      timings: {
        totalMs: 0,
        intent: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'llm-not-configured',
        }),
        planner: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'llm-not-configured',
        }),
        executor: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'llm-not-configured',
        }),
        responder: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'llm-not-configured',
        }),
        verify: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'llm-not-configured',
        }),
      },
    };

    if (isGreetingOnlyMessage(input.message)) {
      return {
        answer: '你好，我在。你现在最想解决哪一件事？我可以帮你拆成今天就能执行的下一步。',
        citations: [...citations, 'fast-path:greeting'],
        meta: {
          model: 'n/a',
          route: 'none',
          llmOk: true,
        },
        trace: {
          ...defaultTrace,
          intent: {
            needPlan: false,
            reason: 'fast-path-greeting',
          },
          timings: {
            totalMs: 0,
            intent: buildStageTiming({
              durationMs: 0,
              model: 'n/a',
              skipped: true,
              reason: 'fast-path-greeting',
            }),
            planner: buildStageTiming({
              durationMs: 0,
              model: 'n/a',
              skipped: true,
              reason: 'fast-path-greeting',
            }),
            executor: buildStageTiming({
              durationMs: 0,
              model: 'n/a',
              skipped: true,
              reason: 'fast-path-greeting',
            }),
            responder: buildStageTiming({
              durationMs: 0,
              model: 'n/a',
              skipped: true,
              reason: 'fast-path-greeting',
            }),
            verify: buildStageTiming({
              durationMs: 0,
              model: 'n/a',
              skipped: true,
              reason: 'fast-path-greeting',
            }),
          },
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
        return await this.runLlmPipeline({
          baseUrl,
          apiKey: dashKey,
          model,
          route: 'dashscope',
          input,
          effectiveAllowSearch,
          trend,
          citations: [...citations, 'provider:bailian-qwen-compatible'],
        });
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
        return await this.runLlmPipeline({
          baseUrl,
          apiKey: openaiKey,
          model,
          route: 'openai',
          input,
          effectiveAllowSearch,
          trend,
          citations: [...citations, 'provider:openai-compatible'],
        });
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

  private async runLlmPipeline(params: {
    baseUrl: string;
    apiKey: string;
    model: string;
    route: 'dashscope' | 'openai';
    input: ChatInput;
    effectiveAllowSearch: boolean;
    trend: string;
    citations: string[];
  }): Promise<ChatOutput> {
    const pipelineStart = Date.now();
    const intentModel =
      process.env.ADVISOR_INTENT_MODEL?.trim() || params.model;
    const plannerModel =
      process.env.ADVISOR_PLANNER_MODEL?.trim() || params.model;
    const responderModel =
      process.env.ADVISOR_RESPONDER_MODEL?.trim() || params.model;
    const verifyModel =
      process.env.ADVISOR_VERIFY_MODEL?.trim() || params.model;
    const verifyEnabled =
      process.env.ADVISOR_ENABLE_VERIFY?.trim().toLowerCase() !== 'false';
    const enableThinking = parseEnableThinking(process.env.ADVISOR_ENABLE_THINKING);
    const slowRequestThresholdMs = parseSlowRequestThresholdMs(
      process.env.ADVISOR_SLOW_REQUEST_THRESHOLD_MS,
    );
    const searchToolTimeoutMs = parseSearchToolTimeoutMs(
      process.env.ADVISOR_SEARCH_TOOL_TIMEOUT_MS,
    );

    const intentStart = Date.now();
    let effectiveIntentModel = intentModel;
    const intent = await runIntentGate({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: intentModel,
      userMessage: params.input.message,
      weeklyTrend: params.trend,
      enableThinking,
    }).catch(async (err) => {
      if (intentModel === params.model) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : 'unknown-error';
      console.warn(
        '[advisor][intent_model_fallback]',
        JSON.stringify({
          route: params.route,
          intentModel,
          fallbackModel: params.model,
          reason,
        }),
      );
      effectiveIntentModel = params.model;
      return runIntentGate({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        model: params.model,
        userMessage: params.input.message,
        weeklyTrend: params.trend,
        enableThinking,
      });
    });
    const intentDurationMs = Date.now() - intentStart;
    const forcePlanForSearch =
      params.effectiveAllowSearch &&
      (hasExplicitSearchIntent(params.input.message) ||
        hasRealtimeLookupIntent(params.input.message) ||
        hasCurrentAffairsLookupIntent(params.input.message));

    if (!intent.needPlan && !forcePlanForSearch) {
      const totalMs = Date.now() - pipelineStart;
      const timings = {
        totalMs,
        intent: buildStageTiming({
          durationMs: intentDurationMs,
          model: effectiveIntentModel,
        }),
        planner: buildStageTiming({
          durationMs: 0,
          model: plannerModel,
          skipped: true,
          reason: 'intent-skip-plan',
        }),
        executor: buildStageTiming({
          durationMs: 0,
          model: 'n/a',
          skipped: true,
          reason: 'intent-skip-plan',
        }),
        responder: buildStageTiming({
          durationMs: 0,
          model: responderModel,
          skipped: true,
          reason: 'intent-skip-plan',
        }),
        verify: buildStageTiming({
          durationMs: 0,
          model: verifyModel,
          skipped: true,
          reason: 'intent-skip-plan',
        }),
      };
      console.log(
        '[advisor][stage_timing]',
        JSON.stringify({
          route: params.route,
          baseModel: params.model,
          forcePlanForSearch,
          timings,
        }),
      );
      logSlowRequestIfNeeded({
        route: params.route,
        baseModel: params.model,
        forcePlanForSearch,
        thresholdMs: slowRequestThresholdMs,
        timings,
      });
      return {
        answer:
          intent.directAnswer.length > 0
            ? intent.directAnswer
            : '我在，你可以告诉我你现在最想推进的一件小事。',
        citations: params.citations,
        meta: {
          model: params.model,
          route: params.route,
          llmOk: true,
        },
        trace: {
          intentPromptFile,
          intent: {
            needPlan: false,
            reason: intent.reason,
          },
          plannerPromptFile,
          toolRegistryFile,
          tasks: [],
          executorSteps: [],
          webLinks: [],
          timings,
        },
      };
    }

    const plannerStart = Date.now();
    const planner = await runPlanner({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: plannerModel,
      userMessage: params.input.message,
      weeklyTrend: params.trend,
      enableThinking,
    });
    const plannerDurationMs = Date.now() - plannerStart;
    const plannerTasks = ensureSearchTaskWhenNeeded({
      tasks: planner.tasks,
      allowSearch: params.effectiveAllowSearch,
      userMessage: params.input.message,
    });
    const executorStart = Date.now();
    const executor = await runExecutor({
      tasks: plannerTasks,
      allowSearch: params.effectiveAllowSearch,
      dashscopeApiKey: process.env.DASHSCOPE_API_KEY?.trim(),
      dashscopeCompatBaseUrl: process.env.DASHSCOPE_COMPAT_BASE_URL?.trim(),
      dashscopeModel: process.env.DASHSCOPE_MODEL?.trim(),
      xBearerToken: process.env.X_BEARER_TOKEN?.trim(),
      tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
      originalMessage: params.input.message,
      searchToolTimeoutMs,
    });
    logSearchQualityFallbackIfNeeded({
      route: params.route,
      baseModel: params.model,
      userMessage: params.input.message,
      notes: executor.notes,
    });
    const executorDurationMs = Date.now() - executorStart;
    const responderStart = Date.now();
    const responder = await runResponder({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: responderModel,
      userMessage: params.input.message,
      tasks: plannerTasks,
      executorSteps: executor.steps,
      executorNotes: executor.notes,
      enableThinking,
    });
    const responderDurationMs = Date.now() - responderStart;
    const webLinks = extractWebLinksFromSteps(executor.steps);
    console.log(
      '[advisor][final_summary_input]',
      JSON.stringify({
        route: params.route,
        model: params.model,
        input: responder.userPayload,
      }),
    );

    let finalAnswer = responder.answer;
    let verifyRawText: string | undefined;
    let verifyDurationMs = 0;
    let verifySkippedReason: string | undefined;
    if (verifyEnabled) {
      const verifyStart = Date.now();
      try {
        const verify = await runVerify({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          model: verifyModel,
          userMessage: params.input.message,
          draftAnswer: responder.answer,
          enableThinking,
        });
        finalAnswer = verify.answer;
        verifyRawText = verify.rawText;
        verifyDurationMs = Date.now() - verifyStart;
        console.log(
          '[advisor][verify_output]',
          JSON.stringify({
            route: params.route,
            model: verifyModel,
            output: verify.answer,
            fallback: false,
          }),
        );
      } catch (err) {
        verifyDurationMs = Date.now() - verifyStart;
        const reason = err instanceof Error ? err.message : 'verify_unknown';
        verifySkippedReason = `verify-fallback:${reason}`;
        console.log(
          '[advisor][verify_output]',
          JSON.stringify({
            route: params.route,
            model: verifyModel,
            output: finalAnswer,
            fallback: true,
            reason,
          }),
        );
      }
    } else {
      verifySkippedReason = 'verify-disabled-by-env';
    }
    const finalAnswerWithLinks = appendWebLinksToAnswer(finalAnswer, webLinks);
    const totalMs = Date.now() - pipelineStart;
    const timings = {
      totalMs,
      intent: buildStageTiming({
        durationMs: intentDurationMs,
        model: effectiveIntentModel,
      }),
      planner: buildStageTiming({
        durationMs: plannerDurationMs,
        model: plannerModel,
      }),
      executor: buildStageTiming({
        durationMs: executorDurationMs,
        model: 'n/a',
      }),
      responder: buildStageTiming({
        durationMs: responderDurationMs,
        model: responderModel,
      }),
      verify: buildStageTiming({
        durationMs: verifyDurationMs,
        model: verifyModel,
        skipped: !verifyEnabled,
        reason: verifySkippedReason,
      }),
    };
    console.log(
      '[advisor][stage_timing]',
      JSON.stringify({
        route: params.route,
        baseModel: params.model,
        forcePlanForSearch,
        timings,
      }),
    );
    logSlowRequestIfNeeded({
      route: params.route,
      baseModel: params.model,
      forcePlanForSearch,
      thresholdMs: slowRequestThresholdMs,
      timings,
    });

    return {
      answer: finalAnswerWithLinks,
      citations: params.citations,
      meta: {
        model: params.model,
        route: params.route,
        llmOk: true,
      },
      trace: {
        intentPromptFile,
        intent: {
          needPlan: true,
          reason: intent.reason,
        },
        plannerPromptFile,
        toolRegistryFile,
        tasks: plannerTasks,
        executorSteps: executor.steps,
        webLinks,
        responderRawText: responder.rawText,
        verifyRawText,
        timings,
      },
    };
  }
}
