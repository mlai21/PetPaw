import 'dart:ui';
import 'package:flutter/material.dart';

/// 模糊淡入入场动画，等价于 Magic UI 的 `BlurFade`。
///
/// 默认效果：从下方 8 像素向上滑入 + 透明度 0→1 + 高斯模糊 6→0。
/// 多个 [MagicBlurFade] 用 [delay] 错峰即可形成阶梯式入场。
///
/// 实现说明：刻意不使用 `flutter_animate` 的 `delay`（其内部用 [Timer] 调度，
/// 在 widget 测试中若未 pump 到位会残留 pending timer）。这里改用单个
/// [AnimationController] + [Interval]，延迟段由曲线区间表达，仅依赖 Ticker，
/// 控制器在 dispose 时回收，测试更稳。
class MagicBlurFade extends StatefulWidget {
  const MagicBlurFade({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 600),
    this.delay = Duration.zero,
    this.offsetY = 8,
    this.blurSigma = 6,
    this.curve = Curves.easeOutCubic,
  });

  final Widget child;
  final Duration duration;
  final Duration delay;

  /// 起始位移（正值表示从下方滑入）。
  final double offsetY;

  /// 起始模糊强度。
  final double blurSigma;

  final Curve curve;

  @override
  State<MagicBlurFade> createState() => _MagicBlurFadeState();
}

class _MagicBlurFadeState extends State<MagicBlurFade>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    final totalMs = widget.delay.inMilliseconds + widget.duration.inMilliseconds;
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: totalMs),
    );
    final delayFraction =
        totalMs == 0 ? 0.0 : widget.delay.inMilliseconds / totalMs;
    _progress = CurvedAnimation(
      parent: _controller,
      curve: Interval(delayFraction, 1, curve: widget.curve),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _progress,
      builder: (context, child) {
        final value = _progress.value;
        final blur = widget.blurSigma * (1 - value);
        return Opacity(
          opacity: value.clamp(0, 1),
          child: Transform.translate(
            offset: Offset(0, widget.offsetY * (1 - value)),
            child: blur < 0.01
                ? child
                : ImageFiltered(
                    imageFilter: ImageFilter.blur(
                      sigmaX: blur,
                      sigmaY: blur,
                      tileMode: TileMode.decal,
                    ),
                    child: child,
                  ),
          ),
        );
      },
      child: widget.child,
    );
  }
}
