import { completeChatCompletions } from '../chat_completions';
import { ExecutionStep, PlanTask, ResponderOutput } from './types';
import { buildResponderUserPayload } from './responder.context';

const responderSystemPrompt = `
你是 PetPaw 的回答生成智能体。
你必须阅读 Planner 任务与 Executor 执行结果，并基于这些信息给出回答。
要求：
1) 优先使用 Executor 中的结果，不要忽略检索信息。
2) 回答简洁可执行，中文输出。
3) 如果外部信息不足，明确说明并给出稳妥建议。
`.trim();

export async function runResponder(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userMessage: string;
  tasks: PlanTask[];
  executorSteps: ExecutionStep[];
  executorNotes: string[];
  enableThinking?: boolean;
}): Promise<ResponderOutput> {
  const userPayload = buildResponderUserPayload({
    userMessage: params.userMessage,
    tasks: params.tasks,
    executorSteps: params.executorSteps,
    executorNotes: params.executorNotes,
  });

  const rawText = await completeChatCompletions({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    system: responderSystemPrompt,
    user: userPayload,
    enableThinking: params.enableThinking,
  });

  return {
    answer: rawText,
    rawText,
    userPayload,
  };
}
