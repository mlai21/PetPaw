import type { SessionStore } from '../persistence/session_store.types';

const DEFAULT_ROLLOUT_PCT = 10;

export async function publishPolicy(
  store: SessionStore,
  input: {
    scope: string;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
    rolloutPct?: number;
  },
): Promise<string> {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hhmm = now.toISOString().slice(11, 16).replace(':', '');
  const version = `v${yyyymmdd}-${hhmm}-${Math.floor(Math.random() * 9000) + 1000}`;
  await store.writePolicy({
    version,
    createdAt: now.getTime(),
    scope: input.scope,
    conditionsJson: JSON.stringify(input.conditions),
    actionsJson: JSON.stringify(input.actions),
    rolloutPct: input.rolloutPct ?? DEFAULT_ROLLOUT_PCT,
  });
  return version;
}
