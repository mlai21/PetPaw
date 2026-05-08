import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';

void main() {
  test('coach mode message is action-oriented', () {
    final text = PersonalityMode.coach.promptPrefix();
    expect(text, contains('行动'));
  });
}
