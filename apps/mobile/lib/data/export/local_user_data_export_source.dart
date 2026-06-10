import 'package:pet_paw_app/data/export/user_data_export_source.dart';
import 'package:pet_paw_app/data/local/app_database.dart';

/// 与 [AppDatabase.requiredTableNames] 对齐的本地导出源。
/// 当前尚无 SQLite 实现，默认返回空列表；可通过 [overrides] 注入或后续接库。
class LocalUserDataExportSource implements UserDataExportSource {
  const LocalUserDataExportSource({Map<String, List<Map<String, dynamic>>>? overrides})
      : _overrides = overrides;

  static List<String> get requiredSectionKeys => AppDatabase.requiredTableNames;

  final Map<String, List<Map<String, dynamic>>>? _overrides;

  @override
  Future<Map<String, List<Map<String, dynamic>>>> loadAllSections() async {
    if (_overrides != null) {
      return {
        for (final key in requiredSectionKeys)
          key: List<Map<String, dynamic>>.from(_overrides[key] ?? const []),
      };
    }
    return {
      for (final key in requiredSectionKeys) key: <Map<String, dynamic>>[],
    };
  }
}
