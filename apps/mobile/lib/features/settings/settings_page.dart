import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/auth/login_page.dart';
import 'package:pet_paw_app/features/magic_showcase/magic_showcase_page.dart';
import 'package:pet_paw_app/features/settings/data_export_page.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Card(
          child: ListTile(
            leading: Icon(Icons.pets),
            title: Text('分身形象管理'),
            subtitle: Text('切换分身形态与互动风格'),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('账户登录'),
            subtitle: const Text('登录后可同步你的顾问数据'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(builder: (_) => const LoginPage()),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            key: const Key('data_export_entry'),
            leading: const Icon(Icons.file_download_outlined),
            title: const Text('数据批量导出'),
            subtitle: const Text('导出日记、宣言书、顾问记忆等全部个人数据'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const DataExportPage(
                    userId: 'local-user',
                    includeRemote: false,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            key: const Key('magic_showcase_entry'),
            leading: const Icon(Icons.auto_awesome_outlined),
            title: const Text('动效组件预览'),
            subtitle: const Text('Magic UI 在 Flutter 端的等价实现（开发期）'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const MagicShowcasePage(),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
