import { Router } from 'express';
import { applySyncPolicy } from './sync.policy';

export const syncRouter = Router();

syncRouter.post('/push', async (req, res) => {
  const filtered = applySyncPolicy(req.body.records ?? []);
  res.json({ records: filtered });
});
