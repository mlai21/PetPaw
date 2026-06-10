import { Router } from 'express';
import { AdvisorService } from './advisor.service';

const advisorService = new AdvisorService();
export const advisorRouter = Router();

advisorRouter.post('/chat', async (req, res) => {
  const output = await advisorService.chat(req.body);
  res.json(output);
});

advisorRouter.get('/tasks/:queueId/status', (req, res) => {
  const queueId = req.params.queueId;
  const output = advisorService.getTaskStatus(queueId);
  res.json(output);
});

const ALLOWED_FEEDBACK_KEYS = new Set([
  'sessionId',
  'feedbackType',
  'messageLengthBucket',
  'userCancelled',
  'timestampMs',
]);
const ALLOWED_FEEDBACK_TYPES = new Set([
  'helpful',
  'notHelpful',
  'regenerateRequested',
  'stoppedByUser',
]);
const ALLOWED_BUCKETS = new Set(['short', 'medium', 'long']);

// E.2 explicit 信号上报：严格白名单校验，拒绝任何原文/答案/PII 字段。
advisorRouter.post('/feedback', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FEEDBACK_KEYS.has(key)) {
      return res.status(400).json({ error: `disallowed_field:${key}` });
    }
  }
  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return res.status(400).json({ error: 'invalid_sessionId' });
  }
  if (typeof body.feedbackType !== 'string' || !ALLOWED_FEEDBACK_TYPES.has(body.feedbackType)) {
    return res.status(400).json({ error: 'invalid_feedbackType' });
  }
  if (
    typeof body.messageLengthBucket !== 'string' ||
    !ALLOWED_BUCKETS.has(body.messageLengthBucket)
  ) {
    return res.status(400).json({ error: 'invalid_messageLengthBucket' });
  }
  console.log('[advisor][explicit_feedback]', JSON.stringify(body));
  return res.status(204).end();
});
