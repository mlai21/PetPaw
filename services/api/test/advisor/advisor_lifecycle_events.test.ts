import { AdvisorService } from '../../src/modules/advisor/advisor.service';
import { runExecutor } from '../../src/modules/advisor/agent_loop/executor.agent';
import { runPlanner } from '../../src/modules/advisor/agent_loop/planner.agent';

jest.mock('../../src/modules/advisor/agent_loop/planner.agent', () => ({
  runPlanner: jest.fn(),
}));

jest.mock('../../src/modules/advisor/agent_loop/executor.agent', () => ({
  runExecutor: jest.fn(),
}));

const mockedPlanner = runPlanner as jest.MockedFunction<typeof runPlanner>;
const mockedExecutor = runExecutor as jest.MockedFunction<typeof runExecutor>;

describe('advisor lifecycle events', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('emits planner and executor events for llm path', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockedPlanner.mockResolvedValue({
      rawText: 'raw',
      answerDraft: 'draft answer',
      tasks: [{ id: 't1', title: 'task', reason: 'reason', needSearch: false }],
    });
    mockedExecutor.mockResolvedValue({
      steps: [],
      notes: [],
      checkpoint: {
        version: 1,
        completedTaskIds: [],
        updatedAt: new Date().toISOString(),
      },
    });

    const service = new AdvisorService();
    const res = await service.chat({
      userId: 'u1',
      message: 'hello',
      allowSearch: false,
    });

    expect(res.trace.events.map((e) => e.event)).toEqual([
      'loop_start',
      'planner_start',
      'planner_done',
      'executor_start',
      'executor_done',
      'loop_end',
    ]);
    expect(res.trace.events.map((e) => e.stage)).toEqual([
      'loop',
      'planner',
      'planner',
      'executor',
      'executor',
      'loop',
    ]);
    expect(res.trace.events[res.trace.events.length - 1]).toMatchObject({
      event: 'loop_end',
      endState: 'completed',
      status: 'completed',
    });
  });

  it('records failure reason on failed loop end', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockedPlanner.mockRejectedValue(new Error('boom'));

    const service = new AdvisorService();
    const res = await service.chat({
      userId: 'u2',
      message: 'hello',
      allowSearch: true,
    });

    const lastEvent = res.trace.events[res.trace.events.length - 1];
    expect(lastEvent).toMatchObject({
      event: 'loop_end',
      stage: 'loop',
      status: 'failed',
      endState: 'failed',
      failureReason: 'boom',
    });
    expect(res.meta.llmOk).toBe(false);
  });

  it('passes input checkpoint to executor and returns updated checkpoint', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockedPlanner.mockResolvedValue({
      rawText: 'raw',
      answerDraft: 'draft answer',
      tasks: [{ id: 't1', title: 'task', reason: 'reason', needSearch: false }],
    });
    mockedExecutor.mockResolvedValue({
      steps: [],
      notes: [],
      checkpoint: {
        version: 1,
        completedTaskIds: ['t1'],
        updatedAt: '2026-05-15T00:00:00.000Z',
      },
    });

    const service = new AdvisorService();
    const res = await service.chat({
      userId: 'u3',
      message: 'hello',
      allowSearch: false,
      checkpoint: {
        version: 1,
        completedTaskIds: ['t0'],
        updatedAt: '2026-05-14T00:00:00.000Z',
      },
    });

    expect(mockedExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint: {
          version: 1,
          completedTaskIds: ['t0'],
          updatedAt: '2026-05-14T00:00:00.000Z',
        },
      }),
    );
    expect(res.trace.checkpoint).toEqual({
      version: 1,
      completedTaskIds: ['t1'],
      updatedAt: '2026-05-15T00:00:00.000Z',
    });
  });

  it('returns queued response when async mode is enabled and requested', async () => {
    process.env.ADVISOR_ENABLE_ASYNC_MODE = 'true';
    process.env.OPENAI_API_KEY = 'test-key';

    const service = new AdvisorService();
    const res = await service.chat({
      userId: 'u4',
      message: 'please run in background',
      allowSearch: true,
      runMode: 'async',
    });

    expect(res.meta).toMatchObject({
      route: 'none',
      model: 'n/a',
      llmOk: false,
    });
    expect(res.answer).toContain('后台队列');
    expect(mockedPlanner).not.toHaveBeenCalled();
    expect(mockedExecutor).not.toHaveBeenCalled();
    expect(res.trace.events.map((e) => e.event)).toEqual([
      'loop_start',
      'loop_queued',
      'loop_end',
    ]);
    expect(res.trace.events[1]).toMatchObject({
      event: 'loop_queued',
      stage: 'loop',
      status: 'waiting',
    });
    expect(res.trace.events[2]).toMatchObject({
      event: 'loop_end',
      stage: 'loop',
      status: 'waiting',
    });
  });
});
