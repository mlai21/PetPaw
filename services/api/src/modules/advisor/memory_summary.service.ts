import { MemoryScope, MemorySummary } from './memory_summary.types';

export class MemorySummaryService {
  summarize(records: Array<{ text: unknown; scope: unknown }>): MemorySummary {
    const facts = records
      .filter(
        (r) =>
          this.isValidScope(r.scope) &&
          typeof r.text === 'string' &&
          r.text.trim().length > 0 &&
          r.scope === 'sync_allowed',
      )
      .map((r) => r.text as string);
    return { facts };
  }

  private isValidScope(scope: unknown): scope is MemoryScope {
    return scope === 'local_only' || scope === 'sync_allowed';
  }
}
