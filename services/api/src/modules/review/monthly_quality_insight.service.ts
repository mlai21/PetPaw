export class MonthlyQualityInsightService {
  private readonly defaultInsight = {
    qualityTrend: 'flat',
    nextMonthFocus: '减少低质量连续中断',
  } as const;

  build(weeklyScores: number[]) {
    const validScores = weeklyScores.filter((score) => Number.isFinite(score));
    if (validScores.length === 0) {
      return this.defaultInsight;
    }

    const avg = Math.round(
      validScores.reduce((a, b) => a + b, 0) / validScores.length,
    );
    return {
      qualityTrend: avg >= 75 ? 'upward' : 'flat',
      nextMonthFocus: avg >= 75 ? '保持高质量行动节奏' : '减少低质量连续中断',
    };
  }
}
