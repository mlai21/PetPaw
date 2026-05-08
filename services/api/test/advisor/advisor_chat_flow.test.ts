import request from 'supertest';
import { app } from '../../src/index';

describe('advisor chat flow', () => {
  it('returns answer with memory and search citations', async () => {
    const res = await request(app).post('/advisor/chat').send({
      userId: 'u1',
      message: 'How should I challenge today?',
      allowSearch: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('citations');
  });
});
