import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/onboarding/avatar_onboarding_models.dart';

void main() {
  group('validateAdvisorName', () {
    test('returns false when trimmed value is shorter than 2', () {
      expect(validateAdvisorName('A'), isFalse);
      expect(validateAdvisorName(' '), isFalse);
    });

    test('returns true when trimmed value length is between 2 and 12', () {
      expect(validateAdvisorName('分身顾问'), isTrue);
      expect(validateAdvisorName('  顾问01  '), isTrue);
      expect(validateAdvisorName('123456789012'), isTrue);
    });

    test('returns false when trimmed value is longer than 12', () {
      expect(validateAdvisorName('1234567890123'), isFalse);
    });
  });

  test('AvatarCandidate stores id imageUrl and previewHint', () {
    const candidate = AvatarCandidate(
      id: 'c1',
      imageUrl: 'https://example.com/c1.png',
      previewHint: 'soft style',
    );

    expect(candidate.id, 'c1');
    expect(candidate.imageUrl, 'https://example.com/c1.png');
    expect(candidate.previewHint, 'soft style');
  });
}
