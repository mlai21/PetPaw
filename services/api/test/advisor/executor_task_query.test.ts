import { runExecutor } from '../../src/modules/advisor/agent_loop/executor.agent';
import { runTavilySearch } from '../../src/modules/advisor/agent_loop/tavily.tool';

jest.mock('../../src/modules/advisor/agent_loop/tavily.tool', () => ({
  runTavilySearch: jest.fn(),
}));

const mockedTavily = runTavilySearch as jest.MockedFunction<
  typeof runTavilySearch
>;

describe('executor task query strategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses task-level query first', async () => {
    mockedTavily.mockResolvedValue('result');

    const output = await runExecutor({
      tasks: [
        {
          id: 't1',
          title: '查找近30天宠物睡眠建议',
          reason: '补充最新可执行建议',
          needSearch: true,
        },
      ],
      allowSearch: true,
      tavilyApiKey: 'key',
      originalMessage: '我家猫最近睡得不稳',
    });

    expect(mockedTavily).toHaveBeenCalledTimes(1);
    expect(mockedTavily.mock.calls[0]?.[0].query).toContain(
      '查找近30天宠物睡眠建议',
    );
    expect(mockedTavily.mock.calls[0]?.[0].query).toContain(
      '补充最新可执行建议',
    );
    expect(mockedTavily.mock.calls[0]?.[0].query).toContain('我家猫最近睡得不稳');
    expect(output.steps[0]?.status).toBe('done');
    expect(output.steps[0]?.inputSummary).toContain('查找近30天宠物睡眠建议');
  });

  it('falls back to original message when task query fails', async () => {
    mockedTavily
      .mockRejectedValueOnce(new Error('task query failed'))
      .mockResolvedValueOnce('fallback result');

    const output = await runExecutor({
      tasks: [
        {
          id: 't1',
          title: '搜实时资讯',
          reason: '确保时效性',
          needSearch: true,
        },
      ],
      allowSearch: true,
      tavilyApiKey: 'key',
      originalMessage: '今天北京天气怎么样',
    });

    expect(mockedTavily).toHaveBeenCalledTimes(2);
    expect(mockedTavily.mock.calls[0]?.[0].query).not.toBe('今天北京天气怎么样');
    expect(mockedTavily.mock.calls[1]?.[0].query).toBe('今天北京天气怎么样');
    expect(output.steps[0]).toMatchObject({
      status: 'done',
      inputSummary: '今天北京天气怎么样',
    });
    expect(output.notes.some((note) => note.includes('fallback'))).toBe(true);
  });
});
