/// 批量导出数据源：从本地库或测试注入读取各表记录。
abstract class UserDataExportSource {
  Future<Map<String, List<Map<String, dynamic>>>> loadAllSections();
}
