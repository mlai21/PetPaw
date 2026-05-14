import { completeChatCompletions } from '../chat_completions';
import { intentSystemPrompt } from './intent.prompt';

export type IntentGateResult = {
  needPlan: boolean;
  reason: string;
  directAnswer: string;
  rawText: string;
};

export async function runIntentGate(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userMessage: string;
  weeklyTrend: string;
  enableThinking?: boolean;
}): Promise<IntentGateResult> {
  const userPayload = [
    `用户输入: ${params.userMessage}`,
    `用户周趋势: ${params.weeklyTrend}`,
    '请输出意图路由 JSON。',
  ].join('\n');
  const rawText = await completeChatCompletions({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    system: intentSystemPrompt,
    user: userPayload,
    enableThinking: params.enableThinking,
  });
  try {
    const parsed = JSON.parse(rawText) as {
      needPlan?: unknown;
      reason?: unknown;
      directAnswer?: unknown;
    };
    const needPlan = parsed.needPlan === true;
    const reason =
      typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'intent-default';
    const directAnswer =
      typeof parsed.directAnswer === 'string' ? parsed.directAnswer.trim() : '';
    return {
      needPlan,
      reason,
      directAnswer,
      rawText,
    };
  } catch (_) {
    return {
      needPlan: false,
      reason: 'intent-parse-fallback',
      directAnswer: rawText.trim(),
      rawText,
    };
  }
}
