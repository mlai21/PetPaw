import request from 'supertest';
import { app } from '../../src/index';

describe('monthly review', () => {
  it('returns strengths blockers and manifesto suggestions', async () => {
    const res = await request(app)
      .post('/review/monthly')
      .send({ userId: 'u1', month: '2026-05' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('strengths');
    expect(res.body).toHaveProperty('blockers');
    expect(res.body).toHaveProperty('manifestoAdjustments');
  });
});
