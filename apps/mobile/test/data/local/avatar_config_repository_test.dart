import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/local/avatar_config_repository.dart';
import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';

void main() {
  test('repository returns default play config with current version', () {
    final repo = AvatarConfigRepository();
    final config = repo.loadDefault();

    expect(config.configVersion, AvatarConfigRepository.currentVersion);
    expect(
      config.prompts.keys,
      containsAll(['healer', 'coach', 'strategist']),
    );
  });

  test('repository version compatibility check is strict equality', () {
    final repo = AvatarConfigRepository();

    expect(repo.isCompatible('v1'), isTrue);
    expect(repo.isCompatible('v0'), isFalse);
  });

  test('repository rejects config with missing required prompt templates', () {
    const invalid = AvatarPlayConfig(
      configVersion: 'v1',
      evolution: EvolutionConfig(streakThreshold: 7, qualityThreshold: 75),
      qualityWeights: QualityWeightsConfig(
        highQualityThreshold: 85,
        mediumQualityThreshold: 60,
        highQualityBonusExp: 8,
        mediumQualityBonusExp: 3,
      ),
      prompts: {'coach': '行动导向'},
    );

    final repo = AvatarConfigRepository();
    expect(repo.hasRequiredFields(invalid), isFalse);
  });
}
