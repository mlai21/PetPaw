import request from 'supertest';
import { app } from '../../../src/index';
import { runAdvisorRuntime } from '../../../src/modules/advisor/runtime/runtime.entry';

describe('Advisor /chat with ADVISOR_RUNTIME_ENABLED', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('exposes the runtime entry function', () => {
    expect(typeof runAdvisorRuntime).toBe('function');
  });

  it('returns the same shape when RUNTIME disabled (back-compat)', async () => {
    delete process.env.ADVISOR_RUNTIME_ENABLED;
    const res = await request(app)
      .post('/advisor/chat')
      .send({ userId: 'u1', message: '你好', allowSearch: false })
      .expect(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('meta.route');
    expect(res.body).toHaveProperty('trace.timings.totalMs');
  });

  it('returns the same shape when RUNTIME enabled (greeting fast path still works)', async () => {
    process.env.ADVISOR_RUNTIME_ENABLED = 'true';
    const res = await request(app)
      .post('/advisor/chat')
      .send({ userId: 'u1', message: '你好', allowSearch: false })
      .expect(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('meta.route');
    expect(res.body).toHaveProperty('trace.timings.totalMs');
  });
});
