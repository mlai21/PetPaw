import { MonthlyQualityInsightService } from '../../src/modules/review/monthly_quality_insight.service';

describe('monthly quality insight', () => {
  it('returns upward trend when avg is greater than 75', () => {
    const out = new MonthlyQualityInsightService().build([72, 80, 84, 78]);
    expect(out.qualityTrend).toBe('upward');
    expect(out.nextMonthFocus).toBe('保持高质量行动节奏');
  });

  it('returns flat trend when avg is less than 75', () => {
    const out = new MonthlyQualityInsightService().build([60, 70, 74, 72]);
    expect(out.qualityTrend).toBe('flat');
    expect(out.nextMonthFocus).toBe('减少低质量连续中断');
  });

  it('returns upward trend when avg equals 75', () => {
    const out = new MonthlyQualityInsightService().build([75, 75, 75, 75]);
    expect(out.qualityTrend).toBe('upward');
    expect(out.nextMonthFocus).toBe('保持高质量行动节奏');
  });

  it('returns default flat insight for empty scores', () => {
    const out = new MonthlyQualityInsightService().build([]);
    expect(out.qualityTrend).toBe('flat');
    expect(out.nextMonthFocus).toBe('减少低质量连续中断');
  });

  it('filters out non-finite values before averaging', () => {
    const out = new MonthlyQualityInsightService().build([
      80,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      70,
    ]);
    expect(out.qualityTrend).toBe('upward');
    expect(out.nextMonthFocus).toBe('保持高质量行动节奏');
  });
});
