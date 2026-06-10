import 'package:flutter/material.dart';

/// 打字机效果，等价于 Magic UI 的 `TypingAnimation`。
///
/// 字符按 [characterDelay] 间隔逐个浮现，末尾可选闪烁光标。
/// 不使用 animated_text_kit（SDK 上限 `<3.0.0` 与当前 Dart 3.8 不兼容），
/// 改用 [AnimationController] + 字符切片自实现，依赖更少。
class MagicTypingText extends StatefulWidget {
  const MagicTypingText(
    this.text, {
    super.key,
    this.style,
    this.characterDelay = const Duration(milliseconds: 50),
    this.startDelay = Duration.zero,
    this.showCursor = true,
    this.cursor = '▍',
    this.textAlign,
    this.maxLines,
  });

  final String text;
  final TextStyle? style;

  /// 每个字符出现的间隔，单字符级别。
  final Duration characterDelay;

  /// 打字开始前的延迟，便于配合入场动画。
  final Duration startDelay;

  final bool showCursor;
  final String cursor;
  final TextAlign? textAlign;
  final int? maxLines;

  @override
  State<MagicTypingText> createState() => _MagicTypingTextState();
}

class _MagicTypingTextState extends State<MagicTypingText>
    with TickerProviderStateMixin {
  late final AnimationController _typingController = AnimationController(
    vsync: this,
    duration: widget.characterDelay * widget.text.runes.length,
  );

  late final AnimationController _cursorController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.startDelay, () {
      if (mounted) _typingController.forward();
    });
  }

  @override
  void dispose() {
    _typingController.dispose();
    _cursorController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final runes = widget.text.runes.toList();
    return AnimatedBuilder(
      animation: Listenable.merge([_typingController, _cursorController]),
      builder: (context, _) {
        final visibleCount = (runes.length * _typingController.value).round();
        final displayed = String.fromCharCodes(runes.take(visibleCount));
        final done = _typingController.isCompleted;
        final cursorVisible = widget.showCursor &&
            (!done || _cursorController.value > 0.5);

        return Text.rich(
          TextSpan(
            children: [
              TextSpan(text: displayed),
              if (cursorVisible)
                TextSpan(
                  text: widget.cursor,
                  style: (widget.style ?? const TextStyle()).copyWith(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
            ],
          ),
          textAlign: widget.textAlign,
          maxLines: widget.maxLines,
          style: widget.style,
        );
      },
    );
  }
}
