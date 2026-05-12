import request from 'supertest';
import { app } from '../../src/index';

describe('avatar onboarding contract', () => {
  it('POST /avatar/onboarding/generate returns 4 candidates', async () => {
    const res = await request(app).post('/avatar/onboarding/generate').send({
      userId: 'u1',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('candidates');
    expect(Array.isArray(res.body.candidates)).toBe(true);
    expect(res.body.candidates).toHaveLength(4);
    expect(res.body.candidates.map((item: { id: string }) => item.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
  });
});
