import 'package:flutter/material.dart';

/// 流光极光渐变文字，等价于 Magic UI 的 `AuroraText`。
///
/// 内部用 [AnimatedBuilder] + [ShaderMask] 让一个多色渐变沿水平方向无限循环移动，
/// 配合 [BlendMode.srcIn] 把渐变贴在文字上，形成 Magic UI 著名的"流动渐变标题"效果。
class MagicAuroraText extends StatefulWidget {
  const MagicAuroraText(
    this.text, {
    super.key,
    this.style,
    this.colors,
    this.duration = const Duration(seconds: 4),
    this.textAlign,
  });

  final String text;
  final TextStyle? style;

  /// 渐变色组（首尾会自动衔接以实现无缝循环）。未传入时使用 Magic UI 默认色。
  final List<Color>? colors;

  final Duration duration;
  final TextAlign? textAlign;

  @override
  State<MagicAuroraText> createState() => _MagicAuroraTextState();
}

class _MagicAuroraTextState extends State<MagicAuroraText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: widget.duration)..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Magic UI 默认极光配色：青绿 → 蓝 → 紫 → 粉
    final palette = widget.colors ??
        const [
          Color(0xFF00D4FF),
          Color(0xFF7C3AED),
          Color(0xFFEC4899),
          Color(0xFFF59E0B),
        ];
    final loopColors = [...palette, palette.first];

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        return ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (rect) {
            return LinearGradient(
              colors: loopColors,
              begin: Alignment(-1 - 2 * t, 0),
              end: Alignment(1 - 2 * t, 0),
              tileMode: TileMode.mirror,
            ).createShader(rect);
          },
          child: Text(
            widget.text,
            textAlign: widget.textAlign,
            style: (widget.style ?? const TextStyle()).copyWith(
              color: Colors.white,
            ),
          ),
        );
      },
    );
  }
}
