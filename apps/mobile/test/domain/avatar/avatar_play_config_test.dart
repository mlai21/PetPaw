import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';
import 'package:pet_paw_app/domain/avatar/evolution_rules.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';
import 'package:pet_paw_app/domain/avatar/quality_weighted_growth.dart';

void main() {
  test('config exposes default version and thresholds', () {
    final config = AvatarPlayConfig.defaults();

    expect(config.configVersion, 'v1');
    expect(config.evolution.streakThreshold, 7);
    expect(config.evolution.qualityThreshold, 75);
  });

  test('evolution rules can be constructed from play config', () {
    final config = AvatarPlayConfig.defaults();
    final rules = EvolutionRules.fromConfig(config);

    final next = rules.nextStage(
      currentStage: 1,
      streakDays: 7,
      weeklyQualityScore: 75,
    );

    expect(next, 2);
  });

  test('quality growth uses exp bonuses from play config', () {
    final config = AvatarPlayConfig.defaults();
    final growth = QualityWeightedGrowth.fromConfig(config);

    expect(growth.expGain(baseExp: 10, qualityScore: 90), 18);
    expect(growth.expGain(baseExp: 10, qualityScore: 60), 13);
  });

  test('personality prompt can be read from play config templates', () {
    final config = AvatarPlayConfig.defaults();

    expect(
      PersonalityMode.coach.promptPrefix(config: config),
      contains('行动'),
    );
  });
}
