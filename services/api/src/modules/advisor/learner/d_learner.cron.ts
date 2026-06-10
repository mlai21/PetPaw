import cron from 'node-cron';
import { runDLearnerOnce } from './d_learner.entry';
import type { SessionStore } from '../persistence/session_store.types';

export function scheduleDLearner(store: SessionStore, cronExpr: string): void {
  if (!cron.validate(cronExpr)) {
    console.warn('[advisor][d_learner] invalid cron expression, skip:', cronExpr);
    return;
  }
  cron.schedule(cronExpr, async () => {
    try {
      const result = await runDLearnerOnce(store);
      console.log(
        '[advisor][d_learner_run]',
        JSON.stringify({ publishedVersions: result.publishedVersions }),
      );
    } catch (err) {
      console.error(
        '[advisor][d_learner_failed]',
        err instanceof Error ? err.message : String(err),
      );
    }
  });
}
