export type MemoryScope = 'local_only' | 'sync_allowed';

export type MemoryRecord = {
  text: string;
  scope: MemoryScope;
};

export type MemorySummary = {
  facts: string[];
};
