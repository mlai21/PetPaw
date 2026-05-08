import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/challenge/challenge_service.dart';

void main() {
  test('manifesto plan yields suggested challenges', () {
    final service = ChallengeService();
    final out = service.suggestFromPlan(['Run 3km']);
    expect(out.first.title, 'Run 3km');
    expect(out.first.source, ChallengeSource.manifesto);
  });
}
