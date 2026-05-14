import { runExecutor } from '../../src/modules/advisor/agent_loop/executor.agent';
import { runBailianSearch } from '../../src/modules/advisor/agent_loop/bailian.tool';
import { runTavilySearch } from '../../src/modules/advisor/agent_loop/tavily.tool';
import { runXSearch } from '../../src/modules/advisor/agent_loop/x.tool';

jest.mock('../../src/modules/advisor/agent_loop/bailian.tool', () => ({
  runBailianSearch: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/x.tool', () => ({
  runXSearch: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/tavily.tool', () => ({
  runTavilySearch: jest.fn(),
}));

describe('executor search fallback', () => {
  const runBailianSearchMock = runBailianSearch as jest.MockedFunction<
    typeof runBailianSearch
  >;
  const runXSearchMock = runXSearch as jest.MockedFunction<typeof runXSearch>;
  const runTavilySearchMock = runTavilySearch as jest.MockedFunction<
    typeof runTavilySearch
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses bailian search first when available', async () => {
    runBailianSearchMock.mockResolvedValue(
      '1. 标题\nhttps://trusted-source.org/a\nbailian-content',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('bailian-search');
    expect(result.steps[0].outputSummary).toContain('bailian-content');
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).not.toHaveBeenCalled();
    expect(runTavilySearchMock).not.toHaveBeenCalled();
  });

  it('falls back to x search when bailian fails', async () => {
    runBailianSearchMock.mockRejectedValue(new Error('bailian-down'));
    runXSearchMock.mockResolvedValue(
      '1. Post by @abc\nhttps://x.com/abc/status/1\nx-content',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('x-search');
    expect(result.steps[0].outputSummary).toContain('x-content');
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).toHaveBeenCalledTimes(1);
    expect(runTavilySearchMock).not.toHaveBeenCalled();
  });

  it('falls back to tavily when bailian and x are unavailable', async () => {
    runTavilySearchMock.mockResolvedValue(
      '1. 标题\nhttps://www.example.org/t1\ntavily-content',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      tavilyApiKey: 'tav-key',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('tavily-search');
    expect(result.steps[0].outputSummary).toContain('tavily-content');
    expect(runBailianSearchMock).not.toHaveBeenCalled();
    expect(runXSearchMock).not.toHaveBeenCalled();
    expect(runTavilySearchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to tavily before x when bailian fails', async () => {
    runBailianSearchMock.mockRejectedValue(new Error('bailian-down'));
    runTavilySearchMock.mockResolvedValue(
      '1. 标题\nhttps://www.example.org/t2\ntavily-content-after-bailian-failed',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      tavilyApiKey: 'tav-key',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('tavily-search');
    expect(result.steps[0].outputSummary).toContain(
      'tavily-content-after-bailian-failed',
    );
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).not.toHaveBeenCalled();
    expect(runTavilySearchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to x when bailian result has no usable url', async () => {
    runBailianSearchMock.mockResolvedValue(
      '1. 标题\nunknown-url\n一些内容',
    );
    runXSearchMock.mockResolvedValue(
      '1. Post by @xyz\nhttps://x.com/xyz/status/2\nx-content-after-bailian-low-quality',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('x-search');
    expect(result.steps[0].outputSummary).toContain(
      'x-content-after-bailian-low-quality',
    );
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts bailian result with mixed unknown and real urls', async () => {
    runBailianSearchMock.mockResolvedValue(
      '1. 结果A\nunknown-url\n片段A\n\n2. 结果B\nhttps://trusted-source.org/b\n片段B',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('bailian-search');
    expect(result.steps[0].outputSummary).toContain('trusted-source.org/b');
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).not.toHaveBeenCalled();
  });

  it('falls back when bailian result only contains example.com links', async () => {
    runBailianSearchMock.mockResolvedValue(
      '1. 标题\nhttps://example.com/fake-source\n看似有内容但不是可信来源',
    );
    runXSearchMock.mockResolvedValue(
      '1. Post by @qwe\nhttps://x.com/qwe/status/3\nx-content-after-example-domain-rejected',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
    });

    expect(result.steps[0].tool).toBe('x-search');
    expect(result.steps[0].outputSummary).toContain(
      'x-content-after-example-domain-rejected',
    );
    expect(result.notes).toEqual(
      expect.arrayContaining(['bailian_empty:task-1', 'x_ok:task-1']),
    );
  });

  it('falls back to x when bailian search times out', async () => {
    runBailianSearchMock.mockImplementation(
      () => new Promise<string>(() => undefined),
    );
    runXSearchMock.mockResolvedValue(
      '1. Post by @timeout\nhttps://x.com/timeout/status/9\nx-content-after-timeout',
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
      searchToolTimeoutMs: 1000,
    });

    expect(result.steps[0].tool).toBe('x-search');
    expect(result.steps[0].outputSummary).toContain('x-content-after-timeout');
    expect(result.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('bailian_failed:task-1:bailian_timeout_1000ms'),
        'x_ok:task-1',
      ]),
    );
  });

  it('uses tavily when tavily wins parallel race against slower bailian', async () => {
    runBailianSearchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve('1. 标题\nhttps://trusted-source.org/slow-bailian\nslow');
          }, 300);
        }),
    );
    runTavilySearchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve('1. 标题\nhttps://trusted-source.org/fast-tavily\nfast');
          }, 20);
        }),
    );

    const result = await runExecutor({
      tasks: [
        {
          id: 'task-1',
          title: '查资料',
          reason: '需要搜索',
          needSearch: true,
        },
      ],
      allowSearch: true,
      dashscopeApiKey: 'dash-key',
      tavilyApiKey: 'tav-key',
      xBearerToken: 'x-token',
      originalMessage: '宠物训练资料',
      searchToolTimeoutMs: 2000,
    });

    expect(result.steps[0].tool).toBe('tavily-search');
    expect(result.steps[0].outputSummary).toContain('fast-tavily');
    expect(runBailianSearchMock).toHaveBeenCalledTimes(1);
    expect(runTavilySearchMock).toHaveBeenCalledTimes(1);
    expect(runXSearchMock).not.toHaveBeenCalled();
    expect(result.notes).toEqual(expect.arrayContaining(['tavily_ok:task-1']));
  });
});
