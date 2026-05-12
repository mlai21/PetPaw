import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';

class QualityWeightedGrowth {
  QualityWeightedGrowth()
      : this._(
          highQualityThreshold:
              AvatarPlayConfig.defaults().qualityWeights.highQualityThreshold,
          mediumQualityThreshold:
              AvatarPlayConfig.defaults().qualityWeights.mediumQualityThreshold,
          highQualityBonusExp:
              AvatarPlayConfig.defaults().qualityWeights.highQualityBonusExp,
          mediumQualityBonusExp:
              AvatarPlayConfig.defaults().qualityWeights.mediumQualityBonusExp,
        );

  QualityWeightedGrowth._({
    required int highQualityThreshold,
    required int mediumQualityThreshold,
    required int highQualityBonusExp,
    required int mediumQualityBonusExp,
  })  : _highQualityThreshold = highQualityThreshold,
        _mediumQualityThreshold = mediumQualityThreshold,
        _highQualityBonusExp = highQualityBonusExp,
        _mediumQualityBonusExp = mediumQualityBonusExp;

  factory QualityWeightedGrowth.fromConfig(AvatarPlayConfig config) {
    return QualityWeightedGrowth._(
      highQualityThreshold: config.qualityWeights.highQualityThreshold,
      mediumQualityThreshold: config.qualityWeights.mediumQualityThreshold,
      highQualityBonusExp: config.qualityWeights.highQualityBonusExp,
      mediumQualityBonusExp: config.qualityWeights.mediumQualityBonusExp,
    );
  }

  final int _highQualityThreshold;
  final int _mediumQualityThreshold;
  final int _highQualityBonusExp;
  final int _mediumQualityBonusExp;

  int expGain({required int baseExp, required int qualityScore}) {
    assert(baseExp >= 0);
    assert(qualityScore >= 0);

    if (qualityScore >= _highQualityThreshold) {
      return baseExp + _highQualityBonusExp;
    }
    if (qualityScore >= _mediumQualityThreshold) {
      return baseExp + _mediumQualityBonusExp;
    }
    return baseExp;
  }
}
