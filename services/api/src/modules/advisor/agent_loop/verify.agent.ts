import { completeChatCompletions } from '../chat_completions';
import { VerifyOutput } from './types';

const verifySystemPrompt = `
你是 PetPaw 的 Verify 智能体。
你的职责是校验并优化回答质量后输出最终版本。
要求：
1) 保持原意，不编造不存在的信息。
2) 修复逻辑跳跃、表述含糊和不必要冗长。
3) 给出最终可直接返回给用户的中文回答，不要附加解释。
`.trim();

export async function runVerify(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userMessage: string;
  draftAnswer: string;
  enableThinking?: boolean;
}): Promise<VerifyOutput> {
  const userPayload = [
    `用户问题: ${params.userMessage}`,
    `待校验回答: ${params.draftAnswer}`,
    '请输出优化后的最终回答。',
  ].join('\n');

  const rawText = await completeChatCompletions({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    system: verifySystemPrompt,
    user: userPayload,
    enableThinking: params.enableThinking,
  });

  return {
    answer: rawText,
    rawText,
  };
}
