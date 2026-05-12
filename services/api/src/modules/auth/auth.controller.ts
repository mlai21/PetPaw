import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/phone/verify', (req, res) => {
  const phone = String(req.body?.phone ?? '00000000000');
  const suffix = phone.slice(-4).padStart(4, '0');

  res.json({
    token: `mock-token-${suffix}`,
    userId: `u-${suffix}`,
  });
});
