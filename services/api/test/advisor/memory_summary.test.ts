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

  it('returns empty facts when all records are local only', () => {
    const service = new MemorySummaryService();
    const out = service.summarize([
      { text: '仅本地记录1', scope: 'local_only' },
      { text: '仅本地记录2', scope: 'local_only' },
    ]);
    expect(out.facts).toEqual([]);
  });

  it('ignores invalid scope and empty text', () => {
    const service = new MemorySummaryService();
    const out = service.summarize([
      { text: '', scope: 'sync_allowed' },
      { text: '   ', scope: 'sync_allowed' },
      { text: '有效行动事实', scope: 'sync_allowed' },
      { text: '非法scope内容', scope: 'global' as unknown as 'sync_allowed' },
    ]);
    expect(out.facts).toEqual(['有效行动事实']);
  });

  it('keeps all sync_allowed facts', () => {
    const service = new MemorySummaryService();
    const out = service.summarize([
      { text: '完成晨跑', scope: 'sync_allowed' },
      { text: '完成冥想', scope: 'sync_allowed' },
      { text: '完成复盘', scope: 'sync_allowed' },
    ]);
    expect(out.facts).toHaveLength(3);
    expect(out.facts).toEqual(['完成晨跑', '完成冥想', '完成复盘']);
  });
});
