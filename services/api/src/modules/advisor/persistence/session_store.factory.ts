import { createMemorySessionStore } from './session_store.memory';
import { createSqliteSessionStore } from './session_store.sqlite';
import type { SessionStore } from './session_store.types';

export function createSessionStoreFromEnv(): SessionStore {
  const kind = (process.env.ADVISOR_SESSION_STORE ?? 'sqlite').trim();
  const retentionDays = Number(process.env.ADVISOR_TRACE_RETENTION_DAYS?.trim() || '90') || 90;
  if (kind === 'memory') {
    return createMemorySessionStore({ retentionDays });
  }
  if (kind === 'sqlite') {
    const dbPath = process.env.ADVISOR_SESSION_STORE_PATH?.trim() || './var/advisor.db';
    return createSqliteSessionStore({ dbPath, retentionDays });
  }
  if (kind === 'postgres') {
    throw new Error('postgres session store: not implemented in E.2 (planned for E.3 evaluation)');
  }
  throw new Error(`unknown ADVISOR_SESSION_STORE: ${kind}`);
}
