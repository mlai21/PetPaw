import { MemoryRecord, MemorySummary } from './memory_summary.types';

export class MemorySummaryService {
  summarize(records: MemoryRecord[]): MemorySummary {
    const facts = records
      .filter((r) => r.scope === 'sync_allowed')
      .map((r) => r.text);
    return { facts };
  }
}
