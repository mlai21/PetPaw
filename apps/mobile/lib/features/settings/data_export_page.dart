import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pet_paw_app/data/export/local_user_data_export_source.dart';
import 'package:pet_paw_app/data/export/user_data_export_service.dart';
import 'package:pet_paw_app/data/remote/user_export_client.dart';

class DataExportPage extends StatefulWidget {
  const DataExportPage({
    super.key,
    required this.userId,
    this.exportService,
    this.exportClient,
    this.includeRemote = true,
  });

  final String userId;
  final UserDataExportService? exportService;
  final UserExportClient? exportClient;
  final bool includeRemote;

  @override
  State<DataExportPage> createState() => _DataExportPageState();
}

class _DataExportPageState extends State<DataExportPage> {
  late final UserDataExportService _exportService;
  UserExportClient? _ownedClient;
  Map<String, int>? _recordCounts;
  bool _loading = true;
  bool _exporting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _exportService = widget.exportService ??
        UserDataExportService(const LocalUserDataExportSource());
    _loadPreview();
  }

  @override
  void dispose() {
    _ownedClient?.dispose();
    super.dispose();
  }

  Future<void> _loadPreview() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      Map<String, dynamic>? remote;
      if (widget.includeRemote) {
        final client = widget.exportClient ?? UserExportClient();
        if (widget.exportClient == null) {
          _ownedClient = client;
        }
        remote = await client.fetchBatchExport(widget.userId);
      }
      final pkg = await _exportService.buildExportPackage(
        userId: widget.userId,
        remotePackage: remote,
      );
      final counts = pkg['meta']?['recordCounts'];
      if (!mounted) return;
      setState(() {
        _recordCounts = counts is Map
            ? counts.map((k, v) => MapEntry(k.toString(), (v as num).toInt()))
            : null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '加载导出预览失败';
        _loading = false;
      });
    }
  }

  Future<void> _exportToClipboard() async {
    setState(() => _exporting = true);
    try {
      Map<String, dynamic>? remote;
      if (widget.includeRemote) {
        final client = widget.exportClient ?? _ownedClient ?? UserExportClient();
        remote = await client.fetchBatchExport(widget.userId);
      }
      final json = await _exportService.buildExportJson(
        userId: widget.userId,
        remotePackage: remote,
      );
      await Clipboard.setData(ClipboardData(text: json));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('导出内容已复制到剪贴板')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('导出失败，请稍后重试')),
      );
    } finally {
      if (mounted) {
        setState(() => _exporting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('数据批量导出')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            '一次性导出日记、宣言书、挑战、月度回顾、顾问记忆与分身状态等全部数据，'
            '生成 JSON 并复制到剪贴板，可粘贴保存为文件。',
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_error != null)
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))
          else if (_recordCounts != null) ...[
            const Text('各分类记录数', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ..._recordCounts!.entries.map(
              (e) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(e.key),
                trailing: Text('${e.value}'),
              ),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            key: const Key('data_export_button'),
            onPressed: _loading || _exporting ? null : _exportToClipboard,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_exporting)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  const Icon(Icons.download_outlined),
                const SizedBox(width: 8),
                Text(_exporting ? '导出中…' : '导出并复制 JSON'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
