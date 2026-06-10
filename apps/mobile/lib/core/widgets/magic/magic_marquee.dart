import 'dart:async';
import 'package:flutter/material.dart';

/// 横向无限滚动跑马灯，等价于 Magic UI 的 `Marquee`。
///
/// 把 [children] 横向铺一遍后整体匀速平移，到达"刚好显示完一份"时瞬移回起点
/// 实现无缝循环。两端用 [_FadeEdges] 做羽化淡出，复刻 Magic UI 的视觉表现。
class MagicMarquee extends StatefulWidget {
  const MagicMarquee({
    super.key,
    required this.children,
    this.height = 48,
    this.gap = 24,
    this.pixelsPerSecond = 40,
    this.reverse = false,
    this.pauseOnHover = false,
    this.fadeEdges = true,
  });

  final List<Widget> children;
  final double height;
  final double gap;

  /// 单位：逻辑像素 / 秒。Magic UI 默认 40。
  final double pixelsPerSecond;

  final bool reverse;

  /// 鼠标悬停暂停（仅 Web/Desktop 有效，移动端忽略）。
  final bool pauseOnHover;

  final bool fadeEdges;

  @override
  State<MagicMarquee> createState() => _MagicMarqueeState();
}

class _MagicMarqueeState extends State<MagicMarquee>
    with SingleTickerProviderStateMixin {
  late final ScrollController _controller = ScrollController();
  Timer? _ticker;
  bool _hovering = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startLoop());
  }

  void _startLoop() {
    const fps = 60;
    final pxPerTick = widget.pixelsPerSecond / fps;
    _ticker = Timer.periodic(
      const Duration(milliseconds: 1000 ~/ fps),
      (_) => _tick(pxPerTick),
    );
  }

  void _tick(double pxPerTick) {
    if (!mounted || !_controller.hasClients) return;
    if (widget.pauseOnHover && _hovering) return;
    final pos = _controller.offset;
    final max = _controller.position.maxScrollExtent;
    if (max <= 0) return;
    // 一份的宽度 = max / 2（因为我们渲染了两份），跨过一份就瞬移回起点
    final segment = max / 2;
    var next = pos + pxPerTick;
    if (next >= segment) next -= segment;
    _controller.jumpTo(next);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rowChildren = <Widget>[];
    for (final c in widget.children) {
      rowChildren.add(c);
      rowChildren.add(SizedBox(width: widget.gap));
    }
    // 渲染两份相同内容，形成"abc | abc"以便瞬移衔接
    final doubled = [...rowChildren, ...rowChildren];

    final body = SizedBox(
      height: widget.height,
      child: ListView(
        controller: _controller,
        physics: const NeverScrollableScrollPhysics(),
        scrollDirection: Axis.horizontal,
        reverse: widget.reverse,
        children: doubled,
      ),
    );

    final wrapped = MouseRegion(
      onEnter: (_) => _hovering = true,
      onExit: (_) => _hovering = false,
      child: body,
    );

    if (!widget.fadeEdges) return wrapped;

    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => const LinearGradient(
        colors: [
          Colors.transparent,
          Colors.black,
          Colors.black,
          Colors.transparent,
        ],
        stops: [0, 0.08, 0.92, 1],
      ).createShader(rect),
      child: wrapped,
    );
  }
}
