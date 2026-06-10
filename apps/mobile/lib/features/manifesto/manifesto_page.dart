import 'package:flutter/material.dart';
import 'package:pet_paw_app/core/widgets/magic/magic.dart';

class ManifestoPage extends StatelessWidget {
  const ManifestoPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MagicBlurFade(
              child: MagicAuroraText(
                '你的宣言书',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 16),
            MagicBlurFade(
              delay: const Duration(milliseconds: 160),
              child: MagicTypingText(
                '把你想成为的样子，写成可以每天兑现的承诺。',
                textAlign: TextAlign.center,
                characterDelay: const Duration(milliseconds: 45),
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(height: 28),
            MagicBlurFade(
              delay: const Duration(milliseconds: 320),
              child: MagicBorderBeam(
                borderRadius: 18,
                baseBorderColor: theme.colorScheme.outlineVariant,
                child: Container(
                  width: 300,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.flag_rounded,
                        size: 32,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '宣言书目标即将上线',
                        style: theme.textTheme.titleMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '届时可在这里设定长期目标，并让今日页自动给出对齐建议。',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
