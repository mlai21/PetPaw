import request from 'supertest';
import { app } from '../../src/index';

describe('phone auth contract', () => {
  it('POST /auth/phone/verify returns token and userId', async () => {
    const res = await request(app).post('/auth/phone/verify').send({
      phone: '13800000000',
      code: '123456',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      token: expect.any(String),
      userId: expect.any(String),
    });
  });
});
