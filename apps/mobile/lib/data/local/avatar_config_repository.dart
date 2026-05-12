import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';

class AvatarConfigRepository {
  static const String currentVersion = 'v1';

  AvatarPlayConfig loadDefault() => AvatarPlayConfig.defaults();

  bool isCompatible(String clientVersion) => clientVersion == currentVersion;

  bool hasRequiredFields(AvatarPlayConfig config) {
    const requiredPromptKeys = {'healer', 'coach', 'strategist'};
    final hasAllPrompts = requiredPromptKeys.every(config.prompts.containsKey);

    return config.configVersion.trim().isNotEmpty &&
        config.evolution.streakThreshold > 0 &&
        config.evolution.qualityThreshold > 0 &&
        config.qualityWeights.highQualityThreshold >=
            config.qualityWeights.mediumQualityThreshold &&
        hasAllPrompts;
  }
}
