import { MonthlyQualityInsightService } from '../../src/modules/review/monthly_quality_insight.service';

describe('monthly quality insight', () => {
  it('returns quality trend and next-month focus', () => {
    const out = new MonthlyQualityInsightService().build([72, 80, 84, 78]);
    expect(out).toHaveProperty('qualityTrend');
    expect(out).toHaveProperty('nextMonthFocus');
  });
});
