class AvatarPlayConfig {
  const AvatarPlayConfig({
    required this.configVersion,
    required this.evolution,
    required this.qualityWeights,
    required this.prompts,
  });

  final String configVersion;
  final EvolutionConfig evolution;
  final QualityWeightsConfig qualityWeights;
  final Map<String, String> prompts;

  factory AvatarPlayConfig.defaults() {
    return const AvatarPlayConfig(
      configVersion: 'v1',
      evolution: EvolutionConfig(streakThreshold: 7, qualityThreshold: 75),
      qualityWeights: QualityWeightsConfig(
        highQualityThreshold: 85,
        mediumQualityThreshold: 60,
        highQualityBonusExp: 8,
        mediumQualityBonusExp: 3,
      ),
      prompts: {
        'healer': '以温和陪伴方式回应，优先稳定情绪',
        'coach': '以行动导向方式回应，给出今天可执行的一步行动',
        'strategist': '以军师方式回应，强调优先级和权衡',
      },
    );
  }
}

class EvolutionConfig {
  const EvolutionConfig({
    required this.streakThreshold,
    required this.qualityThreshold,
  });

  final int streakThreshold;
  final int qualityThreshold;
}

class QualityWeightsConfig {
  const QualityWeightsConfig({
    required this.highQualityThreshold,
    required this.mediumQualityThreshold,
    required this.highQualityBonusExp,
    required this.mediumQualityBonusExp,
  });

  final int highQualityThreshold;
  final int mediumQualityThreshold;
  final int highQualityBonusExp;
  final int mediumQualityBonusExp;
}
