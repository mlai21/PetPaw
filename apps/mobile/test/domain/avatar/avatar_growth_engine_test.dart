import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/avatar_growth_engine.dart';

void main() {
  test('streak triggers stage evolution when not paused', () {
    final state = AvatarGrowthState(
      level: 1,
      exp: 0,
      stage: 1,
      streakDays: 6,
      paused: false,
    );
    final next = AvatarGrowthEngine().onChallengeCompleted(state);
    expect(next.stage, 2);
  });
}
