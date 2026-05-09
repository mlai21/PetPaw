class EvolutionRules {
  const EvolutionRules({
    required this.streakThreshold,
    required this.qualityThreshold,
  });

  final int streakThreshold;
  final int qualityThreshold;

  factory EvolutionRules.defaultRules() {
    return const EvolutionRules(streakThreshold: 7, qualityThreshold: 75);
  }

  int nextStage({
    required int currentStage,
    required int streakDays,
    required int weeklyQualityScore,
  }) {
    assert(currentStage >= 0);
    assert(streakDays >= 0);
    assert(weeklyQualityScore >= 0);

    if (streakDays >= streakThreshold &&
        weeklyQualityScore >= qualityThreshold) {
      return currentStage + 1;
    }
    return currentStage;
  }
}
