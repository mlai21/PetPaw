import { buildResponderUserPayload } from '../../src/modules/advisor/agent_loop/responder.context';
import { PlanTask } from '../../src/modules/advisor/agent_loop/types';

describe('buildResponderUserPayload', () => {
  it('includes planner tasks and executor step outputs', () => {
    const tasks: PlanTask[] = [
      {
        id: 'task-1',
        title: '检索最新趋势',
        reason: '需要外部信息',
        needSearch: true,
      },
    ];
    const payload = buildResponderUserPayload({
      userMessage: '今天宠物训练建议是什么？',
      tasks,
      executorSteps: [
        {
          taskId: 'task-1',
          title: '检索最新趋势',
          status: 'done',
          tool: 'tavily-search',
          inputSummary: '今天宠物训练建议是什么？',
          outputSummary: '检索到 3 条结果',
        },
      ],
      executorNotes: ['tavily_ok:task-1'],
    });

    expect(payload).toContain('用户问题: 今天宠物训练建议是什么？');
    expect(payload).toContain('task-1|检索最新趋势|needSearch=true');
    expect(payload).toContain('tavily-search|done|检索到 3 条结果');
    expect(payload).toContain('tavily_ok:task-1');
  });
});
