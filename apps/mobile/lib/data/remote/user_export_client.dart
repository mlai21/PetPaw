import 'dart:convert';

import 'package:http/http.dart' as http;

/// 从服务端拉取用户批量导出包（`POST /export/batch`）。
class UserExportClient {
  UserExportClient({
    http.Client? client,
    this.baseUrl = 'http://127.0.0.1:3000',
  }) : _client = client ?? http.Client();

  final http.Client _client;
  final String baseUrl;

  Future<Map<String, dynamic>?> fetchBatchExport(String userId) async {
    final uri = Uri.parse('$baseUrl/export/batch');
    final response = await _client.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId}),
    );
    if (response.statusCode != 200) {
      return null;
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      return null;
    }
    return decoded;
  }

  void dispose() {
    _client.close();
  }
}
