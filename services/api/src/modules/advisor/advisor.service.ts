import { completeChatCompletions } from './chat_completions';
import { MemoryRepository } from './memory.repository';
import { SearchProvider } from './search.provider';

type ChatInput = {
  userId: string;
  message: string;
  allowSearch: boolean;
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

  async chat(input: ChatInput): Promise<{
    answer: string;
    citations: string[];
  }> {
    const trend = this.memoryRepository.getWeeklyTrend(input.userId);
    const searchResult = input.allowSearch
      ? this.searchProvider.getHabitLoopArticle(input.message)
      : 'search-disabled';

    const citations = [`memory:${trend}`, `search:${searchResult}`];
    const systemPrompt =
      'You are a concise private habit coach. Ground suggestions in the weekly trend text when relevant. Do not invent user history beyond what is given.';
    const userPayload = `Weekly trend: ${trend}\nSearch snippet: ${searchResult}\nUser message: ${input.message}`;

    const dashKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (dashKey) {
      try {
        const baseUrl =
          process.env.DASHSCOPE_COMPAT_BASE_URL?.trim() ||
          defaultDashscopeBaseUrl;
        const model =
          process.env.DASHSCOPE_MODEL?.trim() || 'qwen3.5-flash';
        const answer = await completeChatCompletions({
          baseUrl,
          apiKey: dashKey,
          model,
          system: systemPrompt,
          user: userPayload,
        });
        return {
          answer,
          citations: [...citations, 'provider:bailian-qwen-compatible'],
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'dashscope_unknown';
        return {
          answer: stubAnswer,
          citations: [...citations, `bailian-error:${reason}`],
        };
      }
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      try {
        const baseUrl =
          process.env.OPENAI_BASE_URL?.trim() || defaultOpenAiBaseUrl;
        const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
        const answer = await completeChatCompletions({
          baseUrl,
          apiKey: openaiKey,
          model,
          system: systemPrompt,
          user: userPayload,
        });
        return {
          answer,
          citations: [...citations, 'provider:openai-compatible'],
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'openai_unknown';
        return {
          answer: stubAnswer,
          citations: [...citations, `openai-error:${reason}`],
        };
      }
    }

    return {
      answer: stubAnswer,
      citations,
    };
  }
}
