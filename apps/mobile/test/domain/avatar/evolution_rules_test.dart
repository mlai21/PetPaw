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
}
