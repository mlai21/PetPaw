import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// 带高光流光的按钮，等价于 Magic UI 的 `ShimmerButton`。
///
/// 一束斜向高光会持续从左到右扫过按钮文字，常用于 CTA / 主操作按钮。
class MagicShimmerButton extends StatelessWidget {
  const MagicShimmerButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.baseColor,
    this.highlightColor,
    this.shimmerDuration = const Duration(milliseconds: 1500),
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
    this.borderRadius = 999,
  });

  final String label;
  final VoidCallback onPressed;
  final IconData? icon;
  final Color? baseColor;
  final Color? highlightColor;
  final Duration shimmerDuration;
  final EdgeInsetsGeometry padding;

  /// 圆角，默认 999 等同于胶囊形状。
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final effectiveBase = baseColor ?? scheme.primary;
    final effectiveHighlight =
        highlightColor ?? Color.lerp(scheme.primary, Colors.white, 0.55)!;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(borderRadius),
        child: Ink(
          decoration: BoxDecoration(
            color: effectiveBase,
            borderRadius: BorderRadius.circular(borderRadius),
            boxShadow: [
              BoxShadow(
                color: effectiveBase.withValues(alpha: 0.45),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: padding,
            child: Shimmer.fromColors(
              baseColor: scheme.onPrimary,
              highlightColor: effectiveHighlight,
              period: shimmerDuration,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: scheme.onPrimary, size: 18),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: TextStyle(
                      color: scheme.onPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
