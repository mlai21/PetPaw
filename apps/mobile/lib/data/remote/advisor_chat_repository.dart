import 'dart:convert';

import 'package:http/http.dart' as http;

/// 顾问对话：默认走后端 `/advisor/chat`，由服务端编排大模型与记忆/搜索。
abstract class AdvisorChatRepository {
  Future<AdvisorReply> askAdvisor(String message, {bool allowSearch = false});

  void dispose() {}
}

class AdvisorReply {
  const AdvisorReply({
    required this.answer,
    required this.model,
    required this.route,
    required this.llmOk,
    required this.tasks,
    required this.completedTaskIds,
  });

  final String answer;
  final String model;
  final String route;
  final bool llmOk;
  final List<AdvisorTask> tasks;
  final List<String> completedTaskIds;
}

class AdvisorTask {
  const AdvisorTask({
    required this.id,
    required this.title,
  });

  final String id;
  final String title;
}

/// 与历史 UI 测试一致的本地假回复（不发起网络请求）。
class StubAdvisorChatRepository implements AdvisorChatRepository {
  const StubAdvisorChatRepository();

  static const String cannedReply =
      '收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。';

  @override
  Future<AdvisorReply> askAdvisor(
    String message, {
    bool allowSearch = false,
  }) async {
    return const AdvisorReply(
      answer: cannedReply,
      model: 'stub',
      route: 'none',
      llmOk: false,
      tasks: [],
      completedTaskIds: [],
    );
  }

  @override
  void dispose() {}
}

class HttpAdvisorChatRepository implements AdvisorChatRepository {
  HttpAdvisorChatRepository({
    required this.baseUrl,
    required this.userId,
    http.Client? httpClient,
  })  : _ownsClient = httpClient == null,
        _client = httpClient ?? http.Client();

  final String baseUrl;
  final String userId;
  final http.Client _client;
  final bool _ownsClient;

  /// `--dart-define=API_BASE_URL=http://10.0.2.2:8787`（Android 模拟器访问宿主机）等。
  factory HttpAdvisorChatRepository.fromEnvironment() {
    const resolvedBase = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    );
    const resolvedUser = String.fromEnvironment(
      'ADVISOR_USER_ID',
      defaultValue: 'local-dev',
    );
    return HttpAdvisorChatRepository(
      baseUrl: resolvedBase,
      userId: resolvedUser,
    );
  }

  Uri get _chatUri {
    final trimmed = baseUrl.trim();
    final root = trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
    return Uri.parse('$root/advisor/chat');
  }

  @override
  Future<AdvisorReply> askAdvisor(
    String message, {
    bool allowSearch = false,
  }) async {
    final response = await _client.post(
      _chatUri,
      headers: const {'Content-Type': 'application/json; charset=utf-8'},
      body: jsonEncode({
        'userId': userId,
        'message': message,
        'allowSearch': allowSearch,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AdvisorChatHttpException(
        '顾问服务返回 ${response.statusCode}',
      );
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw const AdvisorChatHttpException('顾问服务响应格式异常');
    }
    final answer = decoded['answer'];
    if (answer is! String) {
      throw const AdvisorChatHttpException('顾问服务未返回文本内容');
    }
    final trimmed = answer.trim();
    if (trimmed.isEmpty) {
      throw const AdvisorChatHttpException('顾问返回为空');
    }
    final meta = decoded['meta'];
    if (meta is! Map<String, dynamic>) {
      return AdvisorReply(
        answer: trimmed,
        model: 'unknown',
        route: 'none',
        llmOk: false,
        tasks: const [],
        completedTaskIds: const [],
      );
    }
    final trace = decoded['trace'];
    final tasks = <AdvisorTask>[];
    final completedTaskIds = <String>[];
    if (trace is Map<String, dynamic>) {
      final rawTasks = trace['tasks'];
      if (rawTasks is List) {
        for (final item in rawTasks) {
          if (item is Map<String, dynamic> &&
              item['title'] is String &&
              item['id'] is String) {
            tasks.add(
              AdvisorTask(
                id: item['id'] as String,
                title: item['title'] as String,
              ),
            );
          }
        }
      }
      final rawSteps = trace['executorSteps'];
      if (rawSteps is List) {
        for (final step in rawSteps) {
          if (step is Map<String, dynamic> &&
              step['status'] == 'done' &&
              step['taskId'] is String) {
            completedTaskIds.add(step['taskId'] as String);
          }
        }
      }
    }
    return AdvisorReply(
      answer: trimmed,
      model: meta['model'] is String ? meta['model'] as String : 'unknown',
      route: meta['route'] is String ? meta['route'] as String : 'none',
      llmOk: meta['llmOk'] == true,
      tasks: tasks,
      completedTaskIds: completedTaskIds,
    );
  }

  @override
  void dispose() {
    if (_ownsClient) {
      _client.close();
    }
  }
}

class AdvisorChatHttpException implements Exception {
  const AdvisorChatHttpException(this.message);

  final String message;

  @override
  String toString() => message;
}
