import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:pet_paw_app/core/widgets/magic/magic.dart';

/// Magic UI（Flutter 等价）组件预览页。
///
/// 通过设置页的"动效组件预览"隐藏入口进入，开发期用于验证视觉效果。
class MagicShowcasePage extends StatelessWidget {
  const MagicShowcasePage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tiles = <_ShowcaseTile>[
      _ShowcaseTile(
        title: 'AuroraText · 流光渐变标题',
        child: MagicAuroraText(
          'PetPaw, your soul mirror.',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      const _ShowcaseTile(
        title: 'TypingAnimation · 打字机',
        child: MagicTypingText(
          '正在思考你今天的小目标…',
          characterDelay: Duration(milliseconds: 60),
        ),
      ),
      _ShowcaseTile(
        title: 'NumberTicker · 数字滚动',
        child: MagicNumberTicker(
          value: 12480,
          style: theme.textTheme.displaySmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: theme.colorScheme.primary,
          ),
          suffix: ' 步',
        ),
      ),
      _ShowcaseTile(
        title: 'ShimmerButton · 流光按钮',
        child: MagicShimmerButton(
          label: '立即解锁分身',
          icon: Icons.auto_awesome,
          onPressed: () {},
        ),
      ),
      _ShowcaseTile(
        title: 'BorderBeam · 边框光束卡片',
        child: MagicBorderBeam(
          borderRadius: 18,
          baseBorderColor: theme.colorScheme.outlineVariant,
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Icon(Icons.pets, color: theme.colorScheme.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '今日宣言已生成，点击查看 →',
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      _ShowcaseTile(
        title: 'Marquee · 横向跑马灯',
        child: MagicMarquee(
          height: 36,
          gap: 28,
          children: [
            for (final label in const [
              '坚持 30 天',
              '专注力 +12%',
              '复盘 156 次',
              '总步数 230k',
              '宣言已签署',
            ])
              Chip(
                label: Text(label),
                backgroundColor: theme.colorScheme.primaryContainer,
              ),
          ],
        ),
      ),
      _ShowcaseTile(
        title: 'BlurFade · 模糊淡入',
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < 4; i++)
              MagicBlurFade(
                delay: Duration(milliseconds: 120 * i),
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${i + 1}',
                    style: theme.textTheme.titleMedium,
                  ),
                ),
              ),
          ],
        ),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Magic UI 组件预览')),
      body: SafeArea(
        child: AnimationLimiter(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            itemCount: tiles.length,
            separatorBuilder: (_, __) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              return AnimationConfiguration.staggeredList(
                position: index,
                duration: const Duration(milliseconds: 420),
                child: SlideAnimation(
                  verticalOffset: 24,
                  child: FadeInAnimation(child: tiles[index]),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ShowcaseTile extends StatelessWidget {
  const _ShowcaseTile({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 12),
          Align(alignment: Alignment.centerLeft, child: child),
        ],
      ),
    );
  }
}
