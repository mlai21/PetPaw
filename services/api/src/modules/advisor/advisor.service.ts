import { MemoryRepository } from './memory.repository';
import { SearchProvider } from './search.provider';

type ChatInput = {
  userId: string;
  message: string;
  allowSearch: boolean;
};

export class AdvisorService {
  constructor(
    private readonly memoryRepository = new MemoryRepository(),
    private readonly searchProvider = new SearchProvider(),
  ) {}

  chat(input: ChatInput) {
    const trend = this.memoryRepository.getWeeklyTrend(input.userId);
    const searchResult = input.allowSearch
      ? this.searchProvider.getHabitLoopArticle(input.message)
      : 'search-disabled';

    return {
      answer:
        'Start with one manifesto-linked challenge and one custom challenge.',
      citations: [`memory:${trend}`, `search:${searchResult}`],
    };
  }
}
