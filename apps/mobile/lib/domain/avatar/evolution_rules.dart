import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';

class EvolutionRules {
  const EvolutionRules({
    required this.streakThreshold,
    required this.qualityThreshold,
  });

  final int streakThreshold;
  final int qualityThreshold;

  factory EvolutionRules.defaultRules() {
    return EvolutionRules.fromConfig(AvatarPlayConfig.defaults());
  }

  factory EvolutionRules.fromConfig(AvatarPlayConfig config) {
    return EvolutionRules(
      streakThreshold: config.evolution.streakThreshold,
      qualityThreshold: config.evolution.qualityThreshold,
    );
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
