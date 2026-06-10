import 'dart:convert';

import 'package:pet_paw_app/data/export/local_user_data_export_source.dart';
import 'package:pet_paw_app/data/export/user_data_export_source.dart';

class UserDataExportService {
  UserDataExportService(this._source);

  static const schemaVersion = '1.0';

  final UserDataExportSource _source;

  Future<Map<String, dynamic>> buildExportPackage({
    required String userId,
    Map<String, dynamic>? remotePackage,
  }) async {
    final local = await _source.loadAllSections();
    final merged = _mergeSections(local, remotePackage);
    final recordCounts = <String, int>{
      for (final entry in merged.entries) entry.key: entry.value.length,
    };

    return {
      'schemaVersion': schemaVersion,
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'userId': userId,
      'sections': merged,
      'meta': {'recordCounts': recordCounts},
    };
  }

  Future<String> buildExportJson({
    required String userId,
    Map<String, dynamic>? remotePackage,
  }) async {
    final pkg = await buildExportPackage(
      userId: userId,
      remotePackage: remotePackage,
    );
    return const JsonEncoder.withIndent('  ').convert(pkg);
  }

  Map<String, List<Map<String, dynamic>>> _mergeSections(
    Map<String, List<Map<String, dynamic>>> local,
    Map<String, dynamic>? remotePackage,
  ) {
    final keys = LocalUserDataExportSource.requiredSectionKeys;
    final remoteSections = remotePackage?['sections'];
    if (remoteSections is! Map) {
      return local;
    }

    return {
      for (final key in keys)
        key: [
          ...local[key] ?? const [],
          if (remoteSections[key] is List)
            ...List<Map<String, dynamic>>.from(
              (remoteSections[key] as List).map(
                (item) => Map<String, dynamic>.from(item as Map),
              ),
            ),
        ],
    };
  }
}
