import 'package:flutter/material.dart';

/// 数字滚动到目标值的动画，等价于 Magic UI 的 `NumberTicker`。
///
/// 用 [TweenAnimationBuilder] 从 [startValue] 缓动到 [value]，
/// 默认带千分位格式与定点小数位。
class MagicNumberTicker extends StatelessWidget {
  const MagicNumberTicker({
    super.key,
    required this.value,
    this.startValue = 0,
    this.duration = const Duration(milliseconds: 1200),
    this.curve = Curves.easeOutCubic,
    this.style,
    this.decimalPlaces = 0,
    this.thousandsSeparator = ',',
    this.prefix = '',
    this.suffix = '',
  });

  final double value;
  final double startValue;
  final Duration duration;
  final Curve curve;
  final TextStyle? style;

  /// 小数位数（NumberTicker 默认 0）。
  final int decimalPlaces;

  final String thousandsSeparator;
  final String prefix;
  final String suffix;

  String _format(double v) {
    final s = v.toStringAsFixed(decimalPlaces);
    final parts = s.split('.');
    final intStr = parts[0];
    final neg = intStr.startsWith('-');
    final digits = neg ? intStr.substring(1) : intStr;
    final buf = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i != 0 && (digits.length - i) % 3 == 0) buf.write(thousandsSeparator);
      buf.write(digits[i]);
    }
    final withSep = (neg ? '-' : '') + buf.toString();
    final body = parts.length == 2 ? '$withSep.${parts[1]}' : withSep;
    return '$prefix$body$suffix';
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: startValue, end: value),
      duration: duration,
      curve: curve,
      builder: (context, v, _) => Text(_format(v), style: style),
    );
  }
}
