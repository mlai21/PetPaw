import { Router } from 'express';
import { UserBatchExportService } from './export.service';

const exportService = new UserBatchExportService();
export const exportRouter = Router();

exportRouter.post('/batch', (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const pkg = exportService.export(userId);
  const filename = `petpaw-export-${userId}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(pkg);
});
