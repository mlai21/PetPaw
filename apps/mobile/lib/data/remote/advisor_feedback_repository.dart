import 'dart:convert';

import 'package:http/http.dart' as http;

/// explicit 反馈类型。命名与服务端 `ALLOWED_FEEDBACK_TYPES` 一一对应。
enum FeedbackType { helpful, notHelpful, regenerateRequested, stoppedByUser }

/// 消息长度桶。仅上报粒度，绝不上报原文长度或原文。
enum MessageLengthBucket { short, medium, long }

/// 顾问 explicit 信号上报客户端。
///
/// 隐私白名单：payload 只允许 sessionId / feedbackType / messageLengthBucket /
/// userCancelled / timestampMs，绝不包含用户原文、答案、URL、电话、邮箱等 PII。
class AdvisorFeedbackRepository {
  AdvisorFeedbackRepository({required this.baseUrl, http.Client? client})
      : _ownsClient = client == null,
        _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  final bool _ownsClient;

  static Map<String, dynamic> buildPayload({
    required String sessionId,
    required FeedbackType feedbackType,
    required MessageLengthBucket messageLengthBucket,
    required bool userCancelled,
  }) {
    return {
      'sessionId': sessionId,
      'feedbackType': feedbackType.name,
      'messageLengthBucket': messageLengthBucket.name,
      'userCancelled': userCancelled,
      'timestampMs': DateTime.now().millisecondsSinceEpoch,
    };
  }

  Uri _buildUri() {
    final trimmed = baseUrl.trim();
    final root =
        trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
    return Uri.parse('$root/advisor/feedback');
  }

  /// best-effort 上报：网络异常静默吞掉，不影响主链路体验。
  Future<void> report({
    required String sessionId,
    required FeedbackType feedbackType,
    required MessageLengthBucket messageLengthBucket,
    bool userCancelled = false,
  }) async {
    final payload = buildPayload(
      sessionId: sessionId,
      feedbackType: feedbackType,
      messageLengthBucket: messageLengthBucket,
      userCancelled: userCancelled,
    );
    try {
      await _client.post(
        _buildUri(),
        headers: const {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode(payload),
      );
    } catch (_) {
      // explicit feedback 是 best-effort，忽略所有错误
    }
  }

  void dispose() {
    if (_ownsClient) {
      _client.close();
    }
  }
}
