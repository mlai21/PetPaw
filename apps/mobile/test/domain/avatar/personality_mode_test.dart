import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';

void main() {
  test('all personality modes return non-empty semantic prompts', () {
    final healerText = PersonalityMode.healer.promptPrefix();
    final coachText = PersonalityMode.coach.promptPrefix();
    final strategistText = PersonalityMode.strategist.promptPrefix();

    expect(healerText, isNotEmpty);
    expect(coachText, isNotEmpty);
    expect(strategistText, isNotEmpty);

    expect(healerText, contains('温和'));
    expect(coachText, contains('行动'));
    expect(strategistText, contains('优先级'));
  });
}
