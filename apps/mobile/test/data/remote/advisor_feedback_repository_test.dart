import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/remote/advisor_feedback_repository.dart';

void main() {
  group('AdvisorFeedbackRepository', () {
    test('payload contains only whitelisted fields', () {
      final payload = AdvisorFeedbackRepository.buildPayload(
        sessionId: 's-uuid-1',
        feedbackType: FeedbackType.helpful,
        messageLengthBucket: MessageLengthBucket.short,
        userCancelled: false,
      );
      final allowedKeys = {
        'sessionId',
        'feedbackType',
        'messageLengthBucket',
        'userCancelled',
        'timestampMs',
      };
      expect(payload.keys.toSet().difference(allowedKeys), isEmpty);
    });

    test('payload NEVER contains rawMessage, answer, urls, phone, email', () {
      final payload = AdvisorFeedbackRepository.buildPayload(
        sessionId: 's-uuid-1',
        feedbackType: FeedbackType.notHelpful,
        messageLengthBucket: MessageLengthBucket.medium,
        userCancelled: true,
      );
      for (final forbidden in [
        'rawMessage',
        'rawAnswer',
        'message',
        'answer',
        'url',
        'urls',
        'phoneNumber',
        'email',
      ]) {
        expect(payload.containsKey(forbidden), isFalse,
            reason: 'leaked field: $forbidden');
      }
    });

    test('feedbackType serializes to expected wire name', () {
      final payload = AdvisorFeedbackRepository.buildPayload(
        sessionId: 's1',
        feedbackType: FeedbackType.regenerateRequested,
        messageLengthBucket: MessageLengthBucket.long,
        userCancelled: false,
      );
      expect(payload['feedbackType'], 'regenerateRequested');
      expect(payload['messageLengthBucket'], 'long');
    });
  });
}
