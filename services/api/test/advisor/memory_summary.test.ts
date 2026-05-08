import { MemorySummaryService } from '../../src/modules/advisor/memory_summary.service';

describe('memory summary', () => {
  it('keeps actionable facts and drops private raw text', () => {
    const service = new MemorySummaryService();
    const out = service.summarize([
      { text: '我昨晚和家人争执很激烈', scope: 'local_only' },
      { text: '连续3天完成晨间挑战', scope: 'sync_allowed' },
    ]);
    expect(out.facts).toContain('连续3天完成晨间挑战');
    expect(out.facts.join(' ')).not.toContain('争执');
  });
});
