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
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({
      route: expect.any(String),
      llmOk: expect.any(Boolean),
      model: expect.any(String),
    });
    expect(res.body).toHaveProperty('trace');
    expect(res.body.trace).toMatchObject({
      runId: expect.any(String),
      events: expect.any(Array),
    });
    expect(res.body.trace.events.length).toBeGreaterThanOrEqual(2);
    expect(res.body.trace.events[0]).toMatchObject({
      event: 'loop_start',
      stage: 'loop',
      status: 'running',
      runId: res.body.trace.runId,
    });
    const lastEvent = res.body.trace.events[res.body.trace.events.length - 1];
    expect(lastEvent).toMatchObject({
      event: 'loop_end',
      stage: 'loop',
      status: expect.stringMatching(/completed|failed|aborted/),
      endState: expect.stringMatching(/completed|failed|aborted/),
      runId: res.body.trace.runId,
    });
  });

  it('supports async queue status polling endpoint', async () => {
    const prevAsyncFlag = process.env.ADVISOR_ENABLE_ASYNC_MODE;
    process.env.ADVISOR_ENABLE_ASYNC_MODE = 'true';

    try {
      const chatRes = await request(app).post('/advisor/chat').send({
        userId: 'u-async',
        message: '请异步执行',
        allowSearch: true,
        runMode: 'async',
      });
      expect(chatRes.status).toBe(200);
      expect(chatRes.body.trace).toHaveProperty('queueId');
      const queueId = chatRes.body.trace.queueId as string;
      expect(typeof queueId).toBe('string');
      expect(queueId.length).toBeGreaterThan(0);

      const statusRes = await request(app).get(`/advisor/tasks/${queueId}/status`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body).toMatchObject({
        queueId,
        status: 'queued',
        progress: 0,
      });
      expect(statusRes.body.resultPreview).toBe('');
      expect(statusRes.body.result).toBeNull();
    } finally {
      if (prevAsyncFlag === undefined) {
        delete process.env.ADVISOR_ENABLE_ASYNC_MODE;
      } else {
        process.env.ADVISOR_ENABLE_ASYNC_MODE = prevAsyncFlag;
      }
    }
  });

  it('simulates queued to running to completed progression', async () => {
    const prevAsyncFlag = process.env.ADVISOR_ENABLE_ASYNC_MODE;
    process.env.ADVISOR_ENABLE_ASYNC_MODE = 'true';

    try {
      const chatRes = await request(app).post('/advisor/chat').send({
        userId: 'u-async-2',
        message: '请异步执行并观察进度',
        allowSearch: true,
        runMode: 'async',
      });
      const queueId = chatRes.body.trace.queueId as string;

      const first = await request(app).get(`/advisor/tasks/${queueId}/status`);
      const second = await request(app).get(`/advisor/tasks/${queueId}/status`);
      const third = await request(app).get(`/advisor/tasks/${queueId}/status`);

      expect(first.body).toMatchObject({
        queueId,
        status: 'queued',
        progress: 0,
        resultPreview: '',
        result: null,
      });
      expect(second.body).toMatchObject({
        queueId,
        status: 'running',
        progress: 50,
        resultPreview: '',
        result: null,
      });
      expect(third.body).toMatchObject({
        queueId,
        status: 'completed',
        progress: 100,
      });
      expect(typeof third.body.resultPreview).toBe('string');
      expect(third.body.resultPreview.length).toBeGreaterThan(0);
      expect(third.body.result).toMatchObject({
        answer: expect.any(String),
        citations: expect.any(Array),
        meta: {
          route: expect.any(String),
          llmOk: expect.any(Boolean),
          model: expect.any(String),
        },
        trace: {
          runId: expect.any(String),
          events: expect.any(Array),
          plannerPromptFile: expect.any(String),
          toolRegistryFile: expect.any(String),
          tasks: expect.any(Array),
          executorSteps: expect.any(Array),
          checkpoint: {
            version: 1,
            completedTaskIds: expect.any(Array),
            updatedAt: expect.any(String),
          },
        },
      });
      expect(third.body.result.trace.events).toEqual([]);
      expect(third.body.result.citations.length).toBeGreaterThan(0);
    } finally {
      if (prevAsyncFlag === undefined) {
        delete process.env.ADVISOR_ENABLE_ASYNC_MODE;
      } else {
        process.env.ADVISOR_ENABLE_ASYNC_MODE = prevAsyncFlag;
      }
    }
  });
});
