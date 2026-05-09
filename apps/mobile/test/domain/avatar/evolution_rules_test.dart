import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/evolution_rules.dart';

void main() {
  test('evolution advances when streak and quality pass thresholds', () {
    final rules = EvolutionRules.defaultRules();
    final next = rules.nextStage(
      currentStage: 1,
      streakDays: 10,
      weeklyQualityScore: 82,
    );
    expect(next, 2);
  });

  test('evolution does not advance when any threshold is not met', () {
    final rules = EvolutionRules.defaultRules();

    final nextWithLowStreak = rules.nextStage(
      currentStage: 1,
      streakDays: 6,
      weeklyQualityScore: 80,
    );
    final nextWithLowQuality = rules.nextStage(
      currentStage: 1,
      streakDays: 7,
      weeklyQualityScore: 74,
    );

    expect(nextWithLowStreak, 1);
    expect(nextWithLowQuality, 1);
  });

  test('evolution advances when values equal thresholds', () {
    final rules = EvolutionRules.defaultRules();
    final next = rules.nextStage(
      currentStage: 1,
      streakDays: 7,
      weeklyQualityScore: 75,
    );

    expect(next, 2);
  });
}
