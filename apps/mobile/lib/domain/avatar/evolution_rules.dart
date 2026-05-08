class EvolutionThreshold {
  const EvolutionThreshold({
    required this.targetStage,
    required this.minStreakDays,
    required this.minWeeklyQualityScore,
  });

  final int targetStage;
  final int minStreakDays;
  final int minWeeklyQualityScore;
}

class EvolutionRules {
  const EvolutionRules(this._thresholdsByStage);

  final Map<int, EvolutionThreshold> _thresholdsByStage;

  factory EvolutionRules.defaultRules() {
    return EvolutionRules({
      1: const EvolutionThreshold(
        targetStage: 2,
        minStreakDays: 10,
        minWeeklyQualityScore: 80,
      ),
    });
  }

  int nextStage({
    required int currentStage,
    required int streakDays,
    required int weeklyQualityScore,
  }) {
    final threshold = _thresholdsByStage[currentStage];
    if (threshold == null) {
      return currentStage;
    }
    if (streakDays < threshold.minStreakDays) {
      return currentStage;
    }
    if (weeklyQualityScore < threshold.minWeeklyQualityScore) {
      return currentStage;
    }
    return threshold.targetStage;
  }
}
