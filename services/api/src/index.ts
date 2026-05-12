import { config as loadEnv } from 'dotenv';
import express from 'express';

if (process.env.NODE_ENV !== 'test') {
  loadEnv();
}
import { advisorRouter } from './modules/advisor/advisor.controller';
import { authRouter } from './modules/auth/auth.controller';
import { avatarOnboardingRouter } from './modules/avatar/avatar_onboarding.controller';
import { reviewRouter } from './modules/review/monthly_review.controller';

export const app = express();

// Flutter Web（如 http://localhost:7360）请求 API 常见为跨域；须显式放行浏览器 Origin。
app.use((req, res, next) => {
  const origin = req.header('origin');
  if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());
app.use('/auth', authRouter);
app.use('/avatar', avatarOnboardingRouter);
app.use('/advisor', advisorRouter);
app.use('/review', reviewRouter);
