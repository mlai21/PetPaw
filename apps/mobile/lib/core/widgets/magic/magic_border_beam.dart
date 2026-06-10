import 'package:flutter/material.dart';

/// 沿边框循环游走的光束，等价于 Magic UI 的 `BorderBeam`。
///
/// 在子内容外圈叠加一层 [CustomPaint]，绘制一段长度为 [beamLength]
/// 的高光弧线，沿圆角矩形周长循环移动。
class MagicBorderBeam extends StatefulWidget {
  const MagicBorderBeam({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.borderWidth = 1.5,
    this.duration = const Duration(seconds: 4),
    this.beamLength = 0.18,
    this.colorFrom = const Color(0xFF7C3AED),
    this.colorTo = const Color(0xFFEC4899),
    this.baseBorderColor,
  });

  final Widget child;
  final double borderRadius;
  final double borderWidth;
  final Duration duration;

  /// 光束相对边框总周长的比例（0–1）。Magic UI 默认 0.18 左右。
  final double beamLength;

  final Color colorFrom;
  final Color colorTo;

  /// 底色边框，传 null 则不画底框。
  final Color? baseBorderColor;

  @override
  State<MagicBorderBeam> createState() => _MagicBorderBeamState();
}

class _MagicBorderBeamState extends State<MagicBorderBeam>
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: Stack(
        children: [
          widget.child,
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) => CustomPaint(
                  painter: _BorderBeamPainter(
                    progress: _controller.value,
                    radius: widget.borderRadius,
                    strokeWidth: widget.borderWidth,
                    beamLength: widget.beamLength,
                    colorFrom: widget.colorFrom,
                    colorTo: widget.colorTo,
                    baseColor: widget.baseBorderColor,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BorderBeamPainter extends CustomPainter {
  _BorderBeamPainter({
    required this.progress,
    required this.radius,
    required this.strokeWidth,
    required this.beamLength,
    required this.colorFrom,
    required this.colorTo,
    required this.baseColor,
  });

  final double progress;
  final double radius;
  final double strokeWidth;
  final double beamLength;
  final Color colorFrom;
  final Color colorTo;
  final Color? baseColor;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);

    if (baseColor != null) {
      canvas.drawPath(
        path,
        Paint()
          ..color = baseColor!
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth,
      );
    }

    final metric = path.computeMetrics().first;
    final total = metric.length;
    final start = (progress * total) % total;
    final segLen = beamLength * total;
    final end = start + segLen;

    Path beam;
    if (end <= total) {
      beam = metric.extractPath(start, end);
    } else {
      beam = metric.extractPath(start, total)
        ..addPath(metric.extractPath(0, end - total), Offset.zero);
    }

    final shader = LinearGradient(
      colors: [colorFrom.withValues(alpha: 0), colorFrom, colorTo],
      stops: const [0, 0.5, 1],
    ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawPath(
      beam,
      Paint()
        ..shader = shader
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * 1.5
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 2),
    );
  }

  @override
  bool shouldRepaint(_BorderBeamPainter old) =>
      old.progress != progress ||
      old.radius != radius ||
      old.beamLength != beamLength;
}
