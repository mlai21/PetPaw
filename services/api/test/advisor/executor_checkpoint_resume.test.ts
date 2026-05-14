import { runExecutor } from '../../src/modules/advisor/agent_loop/executor.agent';
import { runTavilySearch } from '../../src/modules/advisor/agent_loop/tavily.tool';

jest.mock('../../src/modules/advisor/agent_loop/tavily.tool', () => ({
  runTavilySearch: jest.fn(),
}));

const mockedTavily = runTavilySearch as jest.MockedFunction<
  typeof runTavilySearch
>;

describe('executor checkpoint resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips completed tasks from checkpoint and only executes pending tasks', async () => {
    mockedTavily.mockResolvedValue('ok');

    const output = await runExecutor({
      tasks: [
        { id: 't1', title: 'done task', reason: 'already done', needSearch: true },
        { id: 't2', title: 'pending task', reason: 'do now', needSearch: true },
      ],
      allowSearch: true,
      tavilyApiKey: 'key',
      originalMessage: 'msg',
      checkpoint: {
        version: 1,
        completedTaskIds: ['t1'],
        updatedAt: '2026-05-14T00:00:00.000Z',
      },
    });

    expect(mockedTavily).toHaveBeenCalledTimes(1);
    expect(output.steps[0]).toMatchObject({
      taskId: 't1',
      status: 'skipped',
      inputSummary: 'checkpoint-skip',
    });
    expect(output.steps[1]).toMatchObject({
      taskId: 't2',
      status: 'done',
    });
    expect(output.checkpoint.completedTaskIds).toEqual(
      expect.arrayContaining(['t1', 't2']),
    );
  });

  it('records failed task id in checkpoint when both queries fail', async () => {
    mockedTavily
      .mockRejectedValueOnce(new Error('first fail'))
      .mockRejectedValueOnce(new Error('fallback fail'));

    const output = await runExecutor({
      tasks: [
        { id: 't9', title: 'failing task', reason: 'force fail', needSearch: true },
      ],
      allowSearch: true,
      tavilyApiKey: 'key',
      originalMessage: 'msg',
    });

    expect(output.steps[0]).toMatchObject({
      taskId: 't9',
      status: 'failed',
    });
    expect(output.checkpoint.lastFailedTaskId).toBe('t9');
    expect(output.checkpoint.completedTaskIds).toEqual([]);
  });
});
