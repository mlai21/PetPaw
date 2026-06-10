import 'dart:convert';

import 'package:flutter/foundation.dart';
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
    required this.webLinks,
    required this.thinkingSteps,
    required this.thinkingTotalMs,
  });

  final String answer;
  final String model;
  final String route;
  final bool llmOk;
  final List<AdvisorTask> tasks;
  final List<String> completedTaskIds;
  final List<AdvisorWebLink> webLinks;
  final List<AdvisorThinkingStep> thinkingSteps;
  final int thinkingTotalMs;
}

class AdvisorTask {
  const AdvisorTask({
    required this.id,
    required this.title,
  });

  final String id;
  final String title;
}

class AdvisorWebLink {
  const AdvisorWebLink({
    required this.taskId,
    required this.tool,
    required this.title,
    required this.url,
  });

  final String taskId;
  final String tool;
  final String title;
  final String url;
}

class AdvisorThinkingStep {
  const AdvisorThinkingStep({
    required this.stage,
    required this.title,
    required this.durationMs,
    required this.model,
    required this.skipped,
    this.reason,
  });

  final String stage;
  final String title;
  final int durationMs;
  final String model;
  final bool skipped;
  final String? reason;
}

/// 与历史 UI 测试一致的本地假回复（不发起网络请求）。
class StubAdvisorChatRepository implements AdvisorChatRepository {
  const StubAdvisorChatRepository();

  static const String cannedReply = '收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。';

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
      webLinks: [],
      thinkingSteps: [],
      thinkingTotalMs: 0,
    );
  }

  @override
  void dispose() {}
}

class HttpAdvisorChatRepository implements AdvisorChatRepository {
  HttpAdvisorChatRepository({
    required this.baseUrl,
    required this.userId,
    this.allowDefaultHostFallback = false,
    http.Client? httpClient,
  })  : _ownsClient = httpClient == null,
        _client = httpClient ?? http.Client();

  final String baseUrl;
  final String userId;
  final bool allowDefaultHostFallback;
  final http.Client _client;
  final bool _ownsClient;

  /// `--dart-define=API_BASE_URL=http://10.0.2.2:8787`（Android 模拟器访问宿主机）等。
  factory HttpAdvisorChatRepository.fromEnvironment() {
    const envBase = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    final resolvedBase = envBase.trim().isNotEmpty
        ? envBase.trim()
        : _defaultBaseUrlForRuntime();
    const resolvedUser = String.fromEnvironment(
      'ADVISOR_USER_ID',
      defaultValue: 'local-dev',
    );
    return HttpAdvisorChatRepository(
      baseUrl: resolvedBase,
      userId: resolvedUser,
      allowDefaultHostFallback: envBase.trim().isEmpty,
    );
  }

  static String _defaultBaseUrlForRuntime() {
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host == 'localhost' || host == '127.0.0.1') {
        return 'http://$host:3000';
      }
      // Web 运行在局域网域名/IP 时，默认回同主机 3000 端口。
      return 'http://$host:3000';
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        // Android 模拟器访问宿主机 loopback 必须用 10.0.2.2。
        return 'http://10.0.2.2:3000';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return 'http://127.0.0.1:3000';
      default:
        return 'http://localhost:3000';
    }
  }

  Uri _buildChatUri(String inputBaseUrl) {
    final trimmed = inputBaseUrl.trim();
    final root = trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
    return Uri.parse('$root/advisor/chat');
  }

  List<Uri> _candidateChatUris() {
    final candidates = <String>[];
    final seen = <String>{};

    void addBase(String value) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) {
        return;
      }
      if (seen.add(trimmed)) {
        candidates.add(trimmed);
      }
    }

    addBase(baseUrl);
    if (allowDefaultHostFallback) {
      if (kIsWeb) {
        final host = Uri.base.host;
        if (host.isNotEmpty) {
          addBase('http://$host:3000');
        }
        addBase('http://127.0.0.1:3000');
        addBase('http://localhost:3000');
      } else {
        switch (defaultTargetPlatform) {
          case TargetPlatform.android:
            addBase('http://10.0.2.2:3000');
            addBase('http://127.0.0.1:3000');
            addBase('http://localhost:3000');
          case TargetPlatform.iOS:
          case TargetPlatform.macOS:
            addBase('http://127.0.0.1:3000');
            addBase('http://localhost:3000');
          default:
            addBase('http://localhost:3000');
            addBase('http://127.0.0.1:3000');
        }
      }
    }

    return candidates.map(_buildChatUri).toList(growable: false);
  }

  bool _isTransportError(Object error) {
    if (error is http.ClientException) {
      return true;
    }
    final type = error.runtimeType.toString();
    return type.contains('SocketException') ||
        type.contains('ClientException') ||
        type.contains('HandshakeException');
  }

  Future<AdvisorReply> _requestAndParse(
    Uri uri,
    String message,
    bool allowSearch,
  ) async {
    final response = await _client.post(
      uri,
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
        webLinks: const [],
        thinkingSteps: const [],
        thinkingTotalMs: 0,
      );
    }
    final trace = decoded['trace'];
    final tasks = <AdvisorTask>[];
    final completedTaskIds = <String>[];
    final webLinks = <AdvisorWebLink>[];
    final thinkingSteps = <AdvisorThinkingStep>[];
    var thinkingTotalMs = 0;
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
      final rawWebLinks = trace['webLinks'];
      if (rawWebLinks is List) {
        for (final item in rawWebLinks) {
          if (item is Map<String, dynamic> &&
              item['url'] is String &&
              item['title'] is String &&
              item['taskId'] is String &&
              item['tool'] is String) {
            webLinks.add(
              AdvisorWebLink(
                taskId: item['taskId'] as String,
                tool: item['tool'] as String,
                title: item['title'] as String,
                url: item['url'] as String,
              ),
            );
          }
        }
      }
      final rawTimings = trace['timings'];
      final rawIntent = trace['intent'];
      if (rawTimings is Map<String, dynamic>) {
        thinkingTotalMs = rawTimings['totalMs'] is num
            ? (rawTimings['totalMs'] as num).toInt()
            : 0;
        const stageTitles = {
          'intent': '意图识别',
          'planner': '任务规划',
          'executor': '检索执行',
          'responder': '回答生成',
          'verify': '质量校验',
        };
        for (final stage in stageTitles.keys) {
          final stageTiming = rawTimings[stage];
          if (stageTiming is! Map<String, dynamic>) {
            continue;
          }
          String? reason;
          if (stage == 'intent' &&
              rawIntent is Map<String, dynamic> &&
              rawIntent['reason'] is String) {
            reason = rawIntent['reason'] as String;
          } else if (stageTiming['reason'] is String) {
            reason = stageTiming['reason'] as String;
          }
          thinkingSteps.add(
            AdvisorThinkingStep(
              stage: stage,
              title: stageTitles[stage] ?? stage,
              durationMs: stageTiming['durationMs'] is num
                  ? (stageTiming['durationMs'] as num).toInt()
                  : 0,
              model: stageTiming['model'] is String
                  ? stageTiming['model'] as String
                  : 'n/a',
              skipped: stageTiming['skipped'] == true,
              reason: reason?.trim().isEmpty == true ? null : reason,
            ),
          );
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
      webLinks: webLinks,
      thinkingSteps: thinkingSteps,
      thinkingTotalMs: thinkingTotalMs,
    );
  }

  @override
  Future<AdvisorReply> askAdvisor(
    String message, {
    bool allowSearch = false,
  }) async {
    final uris = _candidateChatUris();
    for (var i = 0; i < uris.length; i++) {
      final uri = uris[i];
      final isLast = i == uris.length - 1;
      try {
        return await _requestAndParse(uri, message, allowSearch);
      } catch (error) {
        final shouldTryNext = !isLast && _isTransportError(error);
        if (!shouldTryNext) {
          rethrow;
        }
      }
    }
    throw const AdvisorChatHttpException('顾问服务暂时不可达');
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
