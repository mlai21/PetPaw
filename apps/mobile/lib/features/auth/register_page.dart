import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/onboarding/avatar_onboarding_page.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _code = TextEditingController();

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('注册')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '创建账号',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '注册用于云端同步与多设备顾问（后端注册接口接入前为界面预览）',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 28),
                TextFormField(
                  key: const Key('register_phone'),
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    final value = v?.trim() ?? '';
                    if (value.isEmpty) return '请输入手机号';
                    if (!RegExp(r'^\d{11}$').hasMatch(value)) return '请输入 11 位手机号';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('register_code'),
                  controller: _code,
                  keyboardType: TextInputType.number,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  decoration: const InputDecoration(
                    labelText: '验证码',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    final value = v?.trim() ?? '';
                    if (value.isEmpty) return '请输入验证码';
                    if (!RegExp(r'^\d{4,6}$').hasMatch(value)) return '请输入 4-6 位数字验证码';
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('register_submit'),
                  onPressed: () {
                    if (!(_formKey.currentState?.validate() ?? false)) {
                      return;
                    }
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => const AvatarOnboardingPage(),
                      ),
                    );
                  },
                  child: const Text('注册'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const Key('register_go_login'),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('已有账号？返回登录'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
