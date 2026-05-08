import { Router } from 'express';
import { MonthlyReviewService } from './monthly_review.service';

const monthlyReviewService = new MonthlyReviewService();
export const reviewRouter = Router();

reviewRouter.post('/monthly', async (_req, res) => {
  res.json(monthlyReviewService.generate());
});
