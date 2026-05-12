import { completeChatCompletions } from '../chat_completions';
import { PlannerOutput, PlanTask } from './types';
import { plannerSystemPrompt } from './planner.prompt';

function normalizeTasks(raw: unknown): PlanTask[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const value = item as Record<string, unknown>;
      const id =
        typeof value.id === 'string' && value.id.trim()
          ? value.id.trim()
          : `task-${index + 1}`;
      const title =
        typeof value.title === 'string' && value.title.trim()
          ? value.title.trim()
          : `子任务 ${index + 1}`;
      const reason =
        typeof value.reason === 'string' && value.reason.trim()
          ? value.reason.trim()
          : '保持执行节奏';
      return {
        id,
        title,
        reason,
        needSearch: value.needSearch === true,
      } satisfies PlanTask;
    })
    .filter((item): item is PlanTask => Boolean(item));
  return normalized.slice(0, 4);
}

export async function runPlanner(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userMessage: string;
  weeklyTrend: string;
}): Promise<PlannerOutput> {
  const userPayload = [
    `用户输入: ${params.userMessage}`,
    `用户周趋势: ${params.weeklyTrend}`,
    '请输出 JSON tasks。',
  ].join('\n');
  const rawText = await completeChatCompletions({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    system: plannerSystemPrompt,
    user: userPayload,
  });
  try {
    const parsed = JSON.parse(rawText) as {
      tasks?: unknown;
      answerDraft?: unknown;
    };
    const tasks = normalizeTasks(parsed.tasks);
    const answerDraft =
      typeof parsed.answerDraft === 'string' && parsed.answerDraft.trim()
        ? parsed.answerDraft.trim()
        : '我已完成初步规划，先从一个 10 分钟内可完成的小步骤开始。';
    if (tasks.length > 0) {
      return { tasks, rawText, answerDraft };
    }
    return {
      tasks: [
        {
          id: 'task-1',
          title: '理解用户当前问题并给出可执行建议',
          reason: '保障回答可落地',
          needSearch: false,
        },
      ],
      rawText,
      answerDraft,
    };
  } catch (_) {
    // fallback below
  }
  return {
    rawText,
    answerDraft: '我已完成初步规划，先从一个 10 分钟内可完成的小步骤开始。',
    tasks: [
      {
        id: 'task-1',
        title: '理解用户当前问题并给出可执行建议',
        reason: '保障回答可落地',
        needSearch: false,
      },
    ],
  };
}
