import { config as loadEnv } from 'dotenv';
import express from 'express';

if (process.env.NODE_ENV !== 'test') {
  loadEnv();
}
import { advisorRouter } from './modules/advisor/advisor.controller';
import { reviewRouter } from './modules/review/monthly_review.controller';

export const app = express();
app.use(express.json());
app.use('/advisor', advisorRouter);
app.use('/review', reviewRouter);
