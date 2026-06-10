/// Magic UI 在 Flutter 端的等价组件库。
///
/// 这些 Widget 复刻了 [magicui.design](https://magicui.design) 的视觉语言，
/// 但完全用 Flutter/Dart 原生能力 + `flutter_animate` / `shimmer` /
/// `flutter_staggered_animations` 实现，**不依赖任何 React/JS 资产**。
///
/// 命名前缀统一用 `Magic`，参数命名尽量与 Magic UI 的 React props 对齐，
/// 方便未来 Web 端（apps/web）做视觉对齐时一一对应。
library magic;

export 'magic_aurora_text.dart';
export 'magic_blur_fade.dart';
export 'magic_border_beam.dart';
export 'magic_marquee.dart';
export 'magic_number_ticker.dart';
export 'magic_shimmer_button.dart';
export 'magic_typing_text.dart';
