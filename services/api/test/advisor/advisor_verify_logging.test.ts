import { AdvisorService } from '../../src/modules/advisor/advisor.service';
import { runExecutor } from '../../src/modules/advisor/agent_loop/executor.agent';
import { runIntentGate } from '../../src/modules/advisor/agent_loop/intent.agent';
import { runPlanner } from '../../src/modules/advisor/agent_loop/planner.agent';
import { runResponder } from '../../src/modules/advisor/agent_loop/responder.agent';
import { runVerify } from '../../src/modules/advisor/agent_loop/verify.agent';

jest.mock('../../src/modules/advisor/agent_loop/intent.agent', () => ({
  runIntentGate: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/planner.agent', () => ({
  runPlanner: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/executor.agent', () => ({
  runExecutor: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/responder.agent', () => ({
  runResponder: jest.fn(),
}));
jest.mock('../../src/modules/advisor/agent_loop/verify.agent', () => ({
  runVerify: jest.fn(),
}));

describe('advisor verify logging', () => {
  const runIntentGateMock = runIntentGate as jest.MockedFunction<
    typeof runIntentGate
  >;
  const runPlannerMock = runPlanner as jest.MockedFunction<typeof runPlanner>;
  const runExecutorMock = runExecutor as jest.MockedFunction<typeof runExecutor>;
  const runResponderMock = runResponder as jest.MockedFunction<typeof runResponder>;
  const runVerifyMock = runVerify as jest.MockedFunction<typeof runVerify>;

  const originalEnv = { ...process.env };
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DASHSCOPE_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    delete process.env.ADVISOR_INTENT_MODEL;
    delete process.env.ADVISOR_PLANNER_MODEL;
    delete process.env.ADVISOR_RESPONDER_MODEL;
    delete process.env.ADVISOR_VERIFY_MODEL;
    delete process.env.ADVISOR_ENABLE_VERIFY;
    delete process.env.ADVISOR_SLOW_REQUEST_THRESHOLD_MS;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs final summary input with executor results and logs verify output', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要多步拆解',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'verify-final-answer',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '测试问题',
          outputSummary: 'EXECUTOR_MARKER: 检索到一条关键内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 测试问题\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER: 检索到一条关键内容',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-verify-test',
      message: '测试问题',
      allowSearch: true,
    });

    expect(output.answer).toBe('verify-final-answer');
    expect(output.meta).toMatchObject({
      route: 'openai',
      llmOk: true,
      model: 'gpt-4o-mini',
    });
    const finalInputCall = consoleLogSpy.mock.calls.find(
      (call) => call[0] === '[advisor][final_summary_input]',
    );
    expect(finalInputCall).toBeDefined();
    const finalInputLog = JSON.parse(finalInputCall?.[1] as string) as {
      input: string;
    };
    expect(finalInputLog.input).toContain('EXECUTOR_MARKER');

    const verifyOutputCall = consoleLogSpy.mock.calls.find(
      (call) => call[0] === '[advisor][verify_output]',
    );
    expect(verifyOutputCall).toBeDefined();
    const verifyOutputLog = JSON.parse(verifyOutputCall?.[1] as string) as {
      output: string;
      fallback: boolean;
    };
    expect(verifyOutputLog.output).toBe('verify-final-answer');
    expect(verifyOutputLog.fallback).toBe(false);
  });

  it('returns fast greeting response without invoking llm pipeline', async () => {
    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-fast-greeting',
      message: '你好',
      allowSearch: true,
    });

    expect(output.answer).toContain('你好');
    expect(output.meta).toMatchObject({
      route: 'none',
      llmOk: true,
      model: 'n/a',
    });
    expect(output.trace.intent.reason).toBe('fast-path-greeting');
    expect(output.trace.timings.totalMs).toBe(0);
    expect(runIntentGateMock).not.toHaveBeenCalled();
    expect(runPlannerMock).not.toHaveBeenCalled();
    expect(runExecutorMock).not.toHaveBeenCalled();
    expect(runResponderMock).not.toHaveBeenCalled();
    expect(runVerifyMock).not.toHaveBeenCalled();
  });

  it('falls back to base model when intent model is unavailable', async () => {
    process.env.ADVISOR_INTENT_MODEL = 'qwen3.5-0.6b';
    runIntentGateMock
      .mockRejectedValueOnce(new Error('chat_http_404:model_not_found'))
      .mockResolvedValueOnce({
        needPlan: false,
        reason: 'fallback-intent-ok',
        directAnswer: '你好，回退成功',
        rawText: '{"needPlan":false}',
      });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-intent-fallback',
      message: '测试意图回退',
      allowSearch: false,
    });

    expect(output.answer).toContain('回退成功');
    expect(runIntentGateMock).toHaveBeenCalledTimes(2);
    expect(runIntentGateMock.mock.calls[0]?.[0]).toMatchObject({
      model: 'qwen3.5-0.6b',
    });
    expect(runIntentGateMock.mock.calls[1]?.[0]).toMatchObject({
      model: 'gpt-4o-mini',
    });
    expect(output.trace.timings.intent.model).toBe('gpt-4o-mini');
  });

  it('falls back to responder answer when verify fails', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要多步拆解',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '测试问题',
          outputSummary: 'EXECUTOR_MARKER: 检索到一条关键内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer-fallback',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 测试问题\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER',
    });
    runVerifyMock.mockRejectedValue(new Error('verify-timeout'));

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-verify-fallback',
      message: '测试问题',
      allowSearch: true,
    });

    expect(output.answer).toBe('responder-answer-fallback');
    const verifyOutputCall = consoleLogSpy.mock.calls.find(
      (call) => call[0] === '[advisor][verify_output]',
    );
    expect(verifyOutputCall).toBeDefined();
    const verifyOutputLog = JSON.parse(verifyOutputCall?.[1] as string) as {
      output: string;
      fallback: boolean;
      reason: string;
    };
    expect(verifyOutputLog.output).toBe('responder-answer-fallback');
    expect(verifyOutputLog.fallback).toBe(true);
    expect(verifyOutputLog.reason).toContain('verify-timeout');
  });

  it('forces planning path for explicit search intent even if intent gate says false', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: false,
      reason: 'intent-misclassified',
      directAnswer: '直接回答',
      rawText: '{"needPlan":false}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '请搜索最新资料',
          outputSummary: 'EXECUTOR_MARKER: 检索到最新资料',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 请搜索最新资料\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER: 检索到最新资料',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-search-intent-override',
      message: '请搜索最新资料并给我建议',
      allowSearch: true,
    });

    expect(output.answer).toBe('verify-final-answer');
    expect(runPlannerMock).toHaveBeenCalledTimes(1);
    expect(runExecutorMock).toHaveBeenCalledTimes(1);
    const finalInputCall = consoleLogSpy.mock.calls.find(
      (call) => call[0] === '[advisor][final_summary_input]',
    );
    expect(finalInputCall).toBeDefined();
  });

  it('auto-enables needSearch for explicit search queries when planner misses it', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要检索',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '汇总信息',
          reason: '先组织回答',
          needSearch: false,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '汇总信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '请搜索最新资料',
          outputSummary: '1. 标题\nhttps://source.example.org\n内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 请搜索最新资料并给建议\nExecutor执行结果:\ntask-1|tavily-search|done|内容',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    await service.chat({
      userId: 'u-explicit-search-auto',
      message: '请搜索最新资料并给建议',
      allowSearch: true,
    });

    expect(runExecutorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            needSearch: true,
          }),
        ]),
      }),
    );
  });

  it('forces weather query to run search and auto-enables needSearch task', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: false,
      reason: 'simple-question',
      directAnswer: '北京今日天气信息需实时查询，建议您使用天气应用查看最新预报。',
      rawText: '{"needPlan":false}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '回答天气问题',
          reason: '单步回答',
          needSearch: false,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '回答天气问题',
          status: 'done',
          tool: 'bailian-search',
          inputSummary: '今天北京的天气和气温是多少？',
          outputSummary: '1. Weather\nhttps://weather.example.org\n北京今日 28°C',
        },
      ],
      notes: ['bailian_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-weather-answer',
      rawText: 'responder-weather-raw',
      userPayload:
        '用户问题: 今天北京的天气和气温是多少？\nExecutor执行结果:\ntask-1|bailian-search|done|北京今日 28°C',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-weather-final-answer',
      rawText: 'verify-weather-raw',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-weather-override',
      message: '今天北京的天气和气温是多少？',
      allowSearch: true,
    });

    expect(output.answer).toContain('verify-weather-final-answer');
    expect(output.answer).toContain('https://weather.example.org');
    expect(runPlannerMock).toHaveBeenCalledTimes(1);
    expect(runExecutorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            needSearch: true,
          }),
        ]),
      }),
    );
  });

  it('forces current affairs query to run search even without explicit search words', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: false,
      reason: 'simple-question',
      directAnswer: '这类问题可能需要核验。',
      rawText: '{"needPlan":false}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '回答时事问题',
          reason: '单步回答',
          needSearch: false,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '回答时事问题',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '特朗普是今天访华吗？',
          outputSummary: '1. News\nhttps://news.example.org\n暂无官方确认',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-current-affairs-answer',
      rawText: 'responder-current-affairs-raw',
      userPayload:
        '用户问题: 特朗普是今天访华吗？\nExecutor执行结果:\ntask-1|tavily-search|done|暂无官方确认',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-current-affairs-final-answer',
      rawText: 'verify-current-affairs-raw',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-current-affairs',
      message: '特朗普是今天访华吗？',
      allowSearch: false,
    });

    expect(output.answer).toContain('verify-current-affairs-final-answer');
    expect(runPlannerMock).toHaveBeenCalledTimes(1);
    expect(runExecutorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            needSearch: true,
          }),
        ]),
      }),
    );
  });

  it('supports stage model overrides and exposes per-stage timings in trace', async () => {
    process.env.ADVISOR_INTENT_MODEL = 'qwen3.5-0.6b';
    process.env.ADVISOR_PLANNER_MODEL = 'qwen3.5-flash';
    process.env.ADVISOR_RESPONDER_MODEL = 'qwen3.5-flash';
    process.env.ADVISOR_VERIFY_MODEL = 'qwen3.5-flash';

    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要多步拆解',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '测试问题',
          outputSummary: 'EXECUTOR_MARKER: 检索到一条关键内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 测试问题\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER: 检索到一条关键内容',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-timing-test',
      message: '测试问题',
      allowSearch: true,
    });

    expect(runIntentGateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen3.5-0.6b' }),
    );
    expect(runPlannerMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen3.5-flash' }),
    );
    expect(runResponderMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen3.5-flash' }),
    );
    expect(runVerifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen3.5-flash' }),
    );
    expect(output.trace.timings.intent.model).toBe('qwen3.5-0.6b');
    expect(output.trace.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(output.trace.timings.intent.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.trace.timings.planner.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.trace.timings.executor.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.trace.timings.responder.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.trace.timings.verify.durationMs).toBeGreaterThanOrEqual(0);

    const stageTimingCall = consoleLogSpy.mock.calls.find(
      (call) => call[0] === '[advisor][stage_timing]',
    );
    expect(stageTimingCall).toBeDefined();
  });

  it('can skip verify stage with env flag to reduce latency', async () => {
    process.env.ADVISOR_ENABLE_VERIFY = 'false';
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要多步拆解',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '测试问题',
          outputSummary: 'EXECUTOR_MARKER: 检索到一条关键内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 测试问题\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER: 检索到一条关键内容',
    });

    const service = new AdvisorService();
    const output = await service.chat({
      userId: 'u-verify-disable',
      message: '测试问题',
      allowSearch: true,
    });

    expect(runVerifyMock).not.toHaveBeenCalled();
    expect(output.answer).toBe('responder-answer');
    expect(output.trace.timings.verify.skipped).toBe(true);
    expect(output.trace.timings.verify.reason).toBe('verify-disabled-by-env');
  });

  it('logs slow request diagnosis when total duration exceeds threshold', async () => {
    process.env.ADVISOR_SLOW_REQUEST_THRESHOLD_MS = '10';
    let fakeNow = 1000;
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => (fakeNow += 8));
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要多步拆解',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '测试问题',
          outputSummary: 'EXECUTOR_MARKER: 检索到一条关键内容',
        },
      ],
      notes: ['tavily_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload:
        '用户问题: 测试问题\nExecutor执行结果:\ntask-1|tavily-search|done|EXECUTOR_MARKER: 检索到一条关键内容',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    await service.chat({
      userId: 'u-slow-threshold',
      message: '测试问题',
      allowSearch: true,
    });
    dateNowSpy.mockRestore();

    const slowLogCall = consoleWarnSpy.mock.calls.find(
      (call) => call[0] === '[advisor][slow_request]',
    );
    expect(slowLogCall).toBeDefined();
    const slowLog = JSON.parse(slowLogCall?.[1] as string) as {
      totalMs: number;
      topStages: Array<{ stage: string; durationMs: number; ratio: number }>;
    };
    expect(slowLog.totalMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(slowLog.topStages)).toBe(true);
    expect(slowLog.topStages.length).toBeGreaterThan(0);
  });

  it('logs search quality fallback when bailian empty then recovered by x', async () => {
    runIntentGateMock.mockResolvedValue({
      needPlan: true,
      reason: '需要检索',
      directAnswer: '',
      rawText: '{"needPlan":true}',
    });
    runPlannerMock.mockResolvedValue({
      rawText: '{"tasks":[{"id":"task-1"}]}',
      answerDraft: 'planner-draft',
      tasks: [
        {
          id: 'task-1',
          title: '检索外部信息',
          reason: '补充事实',
          needSearch: true,
        },
      ],
    });
    runExecutorMock.mockResolvedValue({
      steps: [
        {
          taskId: 'task-1',
          title: '检索外部信息',
          status: 'done',
          tool: 'x-search',
          inputSummary: '测试问题',
          outputSummary: '1. Post by @abc\nhttps://x.com/abc/status/1\nx-content',
        },
      ],
      notes: ['bailian_empty:task-1', 'x_ok:task-1'],
    });
    runResponderMock.mockResolvedValue({
      answer: 'responder-answer',
      rawText: 'responder-raw',
      userPayload: 'payload',
    });
    runVerifyMock.mockResolvedValue({
      answer: 'verify-final-answer',
      rawText: 'verify-raw',
    });

    const service = new AdvisorService();
    await service.chat({
      userId: 'u-search-quality-fallback',
      message: '测试问题',
      allowSearch: true,
    });

    const fallbackLogCall = consoleWarnSpy.mock.calls.find(
      (call) => call[0] === '[advisor][search_quality_fallback]',
    );
    expect(fallbackLogCall).toBeDefined();
    const fallbackLog = JSON.parse(fallbackLogCall?.[1] as string) as {
      fallbackTaskCount: number;
      fallbackTasks: Array<{ taskId: string; recoveredBy: string }>;
    };
    expect(fallbackLog.fallbackTaskCount).toBe(1);
    expect(fallbackLog.fallbackTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-1',
          recoveredBy: 'x-search',
        }),
      ]),
    );
  });
});
