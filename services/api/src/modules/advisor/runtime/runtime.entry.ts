import { randomUUID } from 'node:crypto';
import { runIntentGate } from '../agent_loop/intent.agent';
import { runPlanner } from '../agent_loop/planner.agent';
import { runExecutor } from '../agent_loop/executor.agent';
import { runResponder } from '../agent_loop/responder.agent';
import { runVerify } from '../agent_loop/verify.agent';
import type { ExecutionStep, PlanTask } from '../agent_loop/types';
import { adaptIntent, adaptPlanner, adaptExecutor, adaptResponder, adaptVerify } from './agent_adapter';
import { createMemoryRouterPolicy } from './router_policy.memory';
import { runScheduler, type SchedulerResult } from './scheduler';
import { readRuntimeEnv } from './env';
import { classifyKeywords } from './keyword_categories';
import type { SessionStore } from '../persistence/session_store.types';

/**
 * 解析全局 SessionStore 单例。用 lazy require 而非静态 import，避免与 index.ts 形成
 * 静态循环依赖（runtime.entry 由 advisor.service 动态加载，此时 index 已完成初始化）。
 */
function resolveSessionStore(): SessionStore | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../../index') as { sessionStore?: SessionStore | null };
    return mod.sessionStore ?? undefined;
  } catch {
    return undefined;
  }
}

export type RuntimeEntryInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  intentModel: string;
  plannerModel: string;
  responderModel: string;
  verifyModel: string;
  userMessage: string;
  weeklyTrend: string;
  effectiveAllowSearch: boolean;
  enableThinking: boolean;
  searchToolTimeoutMs: number;
  sessionId?: string;
  sessionStore?: SessionStore;
};

export type RuntimeEntryOutput = SchedulerResult & {
  intentDurationMs: number;
  plannerDurationMs: number;
  executorDurationMs: number;
  responderDurationMs: number;
  verifyDurationMs: number;
  verifyEnabled: boolean;
};

export async function runAdvisorRuntime(input: RuntimeEntryInput): Promise<RuntimeEntryOutput> {
  const env = readRuntimeEnv();
  const router = createMemoryRouterPolicy({
    enabled: env.routerDEnabled,
    mode: env.routerDMode,
    windowMs: env.rollingWindowMs,
  });

  let intentDurationMs = 0;
  let plannerDurationMs = 0;
  let executorDurationMs = 0;
  let responderDurationMs = 0;
  let verifyDurationMs = 0;
  let plannedTasks: PlanTask[] = [];
  let lastExecutorOutput: { steps: ExecutionStep[]; notes: string[] } = { steps: [], notes: [] };

  // Verify 启停沿用现有环境变量（最高优先级，作为 human override）
  const verifyEnabled = process.env.ADVISOR_ENABLE_VERIFY?.trim().toLowerCase() !== 'false';

  const sessionStore = input.sessionStore ?? resolveSessionStore();

  const result = await runScheduler({
    runId: randomUUID(),
    sessionId: input.sessionId ?? randomUUID(),
    userMessage: input.userMessage,
    maxTurns: env.maxTurns,
    maxTasks: env.maxTasks,
    taskMaxRetries: env.taskMaxRetries,
    runtimeTimeoutMs: env.runtimeTimeoutMs,
    router,
    sessionStore,
    keywordCategory: classifyKeywords(input.userMessage),
    adapters: {
      async intent() {
        const start = Date.now();
        const raw = await runIntentGate({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.intentModel,
          userMessage: input.userMessage,
          weeklyTrend: input.weeklyTrend,
          enableThinking: input.enableThinking,
        });
        intentDurationMs = Date.now() - start;
        return adaptIntent(raw, { durationMs: intentDurationMs, model: input.intentModel });
      },
      async planner() {
        const start = Date.now();
        const raw = await runPlanner({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.plannerModel,
          userMessage: input.userMessage,
          weeklyTrend: input.weeklyTrend,
          enableThinking: input.enableThinking,
        });
        plannerDurationMs = Date.now() - start;
        plannedTasks = raw.tasks;
        return adaptPlanner(raw, { durationMs: plannerDurationMs, model: input.plannerModel });
      },
      async executor() {
        const start = Date.now();
        // D 决定的搜索超时（三级降级链：human override > D policy > default）
        const stats = router.getStats();
        const timeoutDecision = router.decide({
          decisionPoint: 'setSearchTimeout',
          signal: {
            messageLengthBucket:
              input.userMessage.length < 20 ? 'short' : input.userMessage.length < 100 ? 'medium' : 'long',
            keywordCategory: classifyKeywords(input.userMessage),
            recentToolFailureRate: stats.toolTotalCount > 0 ? stats.toolFailureCount / stats.toolTotalCount : 0,
            recentVerifyFailRate: stats.verifyTotalCount > 0 ? stats.verifyFailCount / stats.verifyTotalCount : 0,
          },
          defaults: { value: input.searchToolTimeoutMs },
        });
        const raw = await runExecutor({
          tasks: plannedTasks,
          allowSearch: input.effectiveAllowSearch,
          dashscopeApiKey: process.env.DASHSCOPE_API_KEY?.trim(),
          dashscopeCompatBaseUrl: process.env.DASHSCOPE_COMPAT_BASE_URL?.trim(),
          dashscopeModel: process.env.DASHSCOPE_MODEL?.trim(),
          xBearerToken: process.env.X_BEARER_TOKEN?.trim(),
          tavilyApiKey: process.env.TAVILY_API_KEY?.trim(),
          originalMessage: input.userMessage,
          searchToolTimeoutMs: timeoutDecision.value,
        });
        executorDurationMs = Date.now() - start;
        lastExecutorOutput = { steps: raw.steps, notes: raw.notes };
        return adaptExecutor(lastExecutorOutput, { durationMs: executorDurationMs, model: 'n/a' });
      },
      async responder() {
        const start = Date.now();
        const raw = await runResponder({
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.responderModel,
          userMessage: input.userMessage,
          tasks: plannedTasks,
          executorSteps: lastExecutorOutput.steps,
          executorNotes: lastExecutorOutput.notes,
          enableThinking: input.enableThinking,
        });
        responderDurationMs = Date.now() - start;
        return adaptResponder(raw, { durationMs: responderDurationMs, model: input.responderModel });
      },
      async verify({ draft }) {
        if (!verifyEnabled) {
          return adaptVerify({ answer: draft, rawText: '', fallback: true }, { durationMs: 0, model: input.verifyModel });
        }
        const start = Date.now();
        try {
          const raw = await runVerify({
            baseUrl: input.baseUrl,
            apiKey: input.apiKey,
            model: input.verifyModel,
            userMessage: input.userMessage,
            draftAnswer: draft,
            enableThinking: input.enableThinking,
          });
          verifyDurationMs = Date.now() - start;
          return adaptVerify(
            { answer: raw.answer, rawText: raw.rawText, fallback: false },
            { durationMs: verifyDurationMs, model: input.verifyModel },
          );
        } catch {
          verifyDurationMs = Date.now() - start;
          return adaptVerify(
            { answer: draft, rawText: '', fallback: true },
            { durationMs: verifyDurationMs, model: input.verifyModel },
          );
        }
      },
    },
  });

  return {
    ...result,
    intentDurationMs,
    plannerDurationMs,
    executorDurationMs,
    responderDurationMs,
    verifyDurationMs,
    verifyEnabled,
  };
}
