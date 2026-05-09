import 'package:flutter/material.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Card(
          child: ListTile(
            leading: Icon(Icons.pets),
            title: Text('分身形象管理'),
            subtitle: Text('切换分身形态与互动风格'),
          ),
        ),
        SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: Icon(Icons.person_outline),
            title: Text('账户登录'),
            subtitle: Text('登录后可同步你的顾问数据'),
          ),
        ),
      ],
    );
  }
}
