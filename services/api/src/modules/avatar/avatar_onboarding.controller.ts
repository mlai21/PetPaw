import { Router } from 'express';

export const avatarOnboardingRouter = Router();

avatarOnboardingRouter.post('/onboarding/generate', (_req, res) => {
  res.json({
    candidates: [
      { id: 'c1', name: 'Calm Healer' },
      { id: 'c2', name: 'Steady Coach' },
      { id: 'c3', name: 'Sharp Strategist' },
      { id: 'c4', name: 'Warm Companion' },
    ],
  });
});
