import 'package:flutter/material.dart';
import 'package:pet_paw_app/core/widgets/magic/magic.dart';

class TodayPage extends StatefulWidget {
  const TodayPage({super.key, this.onAskAdvisor});

  final ValueChanged<Map<String, String>>? onAskAdvisor;

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  final _affirmController = TextEditingController();
  final _challengeController = TextEditingController();
  bool _showChallengeSuggestions = false;

  bool get _isComplete =>
      _affirmController.text.trim().isNotEmpty &&
      _challengeController.text.trim().isNotEmpty;

  @override
  void dispose() {
    _affirmController.dispose();
    _challengeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        MagicBlurFade(
          child: _TodayHeader(),
        ),
        const SizedBox(height: 12),
        MagicBlurFade(
          delay: const Duration(milliseconds: 120),
          child: _SectionCard(
            title: '肯定昨天的自己',
            subtitle: '一句话写下：做得好的事 + 要感谢的人',
            child: TextField(
              key: const Key('today_affirm_input'),
              controller: _affirmController,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: '例如：谢谢昨天坚持晨跑的自己',
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MagicBlurFade(
          delay: const Duration(milliseconds: 220),
          child: _SectionCard(
            title: '今天要挑战的事',
            subtitle: '一句话写下今天最想完成的挑战',
            child: TextField(
              key: const Key('today_challenge_input'),
              controller: _challengeController,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: '例如：今晚完成30分钟深度工作',
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.tonal(
          onPressed: () => setState(() => _showChallengeSuggestions = true),
          child: const Text('获取建议'),
        ),
        if (_showChallengeSuggestions) ...[
          const SizedBox(height: 12),
          MagicBlurFade(
            child: MagicBorderBeam(
              borderRadius: 12,
              baseBorderColor: theme.colorScheme.outlineVariant,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('来自宣言书的建议项'),
                    SizedBox(height: 8),
                    Text('Run 3km'),
                    Text('晚间复盘 10 分钟'),
                  ],
                ),
              ),
            ),
          ),
        ],
        if (_isComplete) ...[
          const SizedBox(height: 16),
          Center(
            child: MagicShimmerButton(
              label: '带着今天的状态问顾问',
              icon: Icons.auto_awesome,
              onPressed: () {
                widget.onAskAdvisor?.call({
                  'affirmation': _affirmController.text.trim(),
                  'challenge': _challengeController.text.trim(),
                });
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _TodayHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: MagicAuroraText(
        '今天，遇见更好的自己',
        style: theme.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(subtitle),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
