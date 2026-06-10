import {
  adaptIntent,
  adaptExecutor,
  adaptVerify,
} from '../../../src/modules/advisor/runtime/agent_adapter';

describe('Agent wrappers (E.1)', () => {
  describe('adaptIntent', () => {
    it('returns done with directAnswer when needPlan=false', () => {
      const result = adaptIntent({
        needPlan: false,
        reason: 'fast-path',
        directAnswer: '你好，我在。',
        rawText: '',
      }, { durationMs: 10, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      if (result.nextAction.kind === 'done') {
        expect(result.nextAction.finalAnswer).toBe('你好，我在。');
      }
      expect(result.trace.agentName).toBe('intent');
    });

    it('returns continue when needPlan=true', () => {
      const result = adaptIntent({
        needPlan: true,
        reason: 'complex-question',
        directAnswer: '',
        rawText: '',
      }, { durationMs: 10, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('continue');
    });
  });

  describe('adaptExecutor', () => {
    it('returns retry_task on the first failed step', () => {
      const result = adaptExecutor({
        steps: [
          { taskId: 't-1', title: 't1', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'ok' },
          { taskId: 't-2', title: 't2', status: 'failed', tool: 'bailian-search', inputSummary: 'q', outputSummary: 'err' },
        ],
        notes: ['bailian_failed:t-2:timeout'],
      }, { durationMs: 100, model: 'n/a' });
      expect(result.nextAction.kind).toBe('retry_task');
      if (result.nextAction.kind === 'retry_task') {
        expect(result.nextAction.taskId).toBe('t-2');
      }
    });

    it('returns continue when all steps done', () => {
      const result = adaptExecutor({
        steps: [
          { taskId: 't-1', title: 't1', status: 'done', tool: 'tavily-search', inputSummary: 'q', outputSummary: 'ok' },
        ],
        notes: ['tavily_ok:t-1'],
      }, { durationMs: 100, model: 'n/a' });
      expect(result.nextAction.kind).toBe('continue');
    });
  });

  describe('adaptVerify', () => {
    it('returns done with verify.answer when not fallback', () => {
      const result = adaptVerify({
        answer: '校验后的答案',
        rawText: '...',
        fallback: false,
      }, { durationMs: 50, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      if (result.nextAction.kind === 'done') {
        expect(result.nextAction.finalAnswer).toBe('校验后的答案');
      }
    });

    it('returns done with fallback answer + reason in trace when fallback=true', () => {
      const result = adaptVerify({
        answer: '草稿答案',
        rawText: '',
        fallback: true,
      }, { durationMs: 0, model: 'qwen3.5-flash' });
      expect(result.nextAction.kind).toBe('done');
      expect(result.trace.skipped).toBe(true);
      expect(result.trace.reason).toMatch(/verify-fallback/);
    });
  });
});
