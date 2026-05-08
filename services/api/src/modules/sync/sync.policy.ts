export type SyncScope = 'local_only' | 'sync_allowed';

export function applySyncPolicy(records: Array<{ id: string; scope: SyncScope }>) {
  return records.filter((record) => record.scope === 'sync_allowed');
}
