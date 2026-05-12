import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/auth/login_page.dart';

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
      ],
    );
  }
}
