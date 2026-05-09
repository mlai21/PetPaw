import 'package:flutter/material.dart';

class TodayPage extends StatefulWidget {
  const TodayPage({
    super.key,
    this.onAskAdvisor,
  });

  /// Emits user context when the user taps the advisor CTA. Keys: `affirmation`, `challenge`.
  final void Function(Map<String, String> payload)? onAskAdvisor;

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  final TextEditingController _affirmController = TextEditingController();
  final TextEditingController _challengeController = TextEditingController();

  bool get _bothFilled {
    final a = _affirmController.text.trim();
    final b = _challengeController.text.trim();
    return a.isNotEmpty && b.isNotEmpty;
  }

  void _notifyTextChanged() => setState(() {});

  @override
  void dispose() {
    _affirmController.dispose();
    _challengeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const ctaLabel = '带着今天的状态问顾问';

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              key: const ValueKey('today_affirm_input'),
              controller: _affirmController,
              decoration: const InputDecoration(
                labelText: '昨日感谢',
              ),
              onChanged: (_) => _notifyTextChanged(),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const ValueKey('today_challenge_input'),
              controller: _challengeController,
              decoration: const InputDecoration(
                labelText: '今日挑战',
              ),
              onChanged: (_) => _notifyTextChanged(),
            ),
            if (_bothFilled) ...[
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () {
                  widget.onAskAdvisor?.call({
                    'affirmation': _affirmController.text.trim(),
                    'challenge': _challengeController.text.trim(),
                  });
                },
                child: const Text(ctaLabel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
