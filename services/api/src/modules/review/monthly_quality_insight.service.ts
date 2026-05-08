export class MonthlyQualityInsightService {
  build(weeklyScores: number[]) {
    const avg = Math.round(
      weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length,
    );
    return {
      qualityTrend: avg >= 75 ? 'upward' : 'flat',
      nextMonthFocus: avg >= 75 ? '保持高质量行动节奏' : '减少低质量连续中断',
    };
  }
}
