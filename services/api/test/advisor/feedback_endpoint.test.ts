import request from 'supertest';
import { app } from '../../src/index';

describe('POST /advisor/feedback', () => {
  it('accepts valid payload and returns 204', async () => {
    await request(app)
      .post('/advisor/feedback')
      .send({
        sessionId: 's1',
        feedbackType: 'helpful',
        messageLengthBucket: 'short',
        userCancelled: false,
        timestampMs: Date.now(),
      })
      .expect(204);
  });

  it('rejects payload containing forbidden fields with 400', async () => {
    const res = await request(app).post('/advisor/feedback').send({
      sessionId: 's1',
      feedbackType: 'helpful',
      messageLengthBucket: 'short',
      userCancelled: false,
      rawMessage: '用户原文（不允许）',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/disallowed_field/);
  });

  it('rejects payload with invalid feedbackType', async () => {
    const res = await request(app).post('/advisor/feedback').send({
      sessionId: 's1',
      feedbackType: 'nonsense',
      messageLengthBucket: 'short',
      userCancelled: false,
    });
    expect(res.status).toBe(400);
  });

  it('rejects payload with invalid messageLengthBucket', async () => {
    const res = await request(app).post('/advisor/feedback').send({
      sessionId: 's1',
      feedbackType: 'helpful',
      messageLengthBucket: 'huge',
      userCancelled: false,
    });
    expect(res.status).toBe(400);
  });
});
