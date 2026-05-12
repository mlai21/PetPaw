import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/platform/desktop/desktop_capability.dart';

void main() {
  test('desktop capability reports feature flags', () {
    final caps = DesktopCapability.defaultCaps();
    expect(caps.supportsGlobalOverlay, false);
    expect(caps.supportsTray, false);
    expect(caps.supportsQuickInvoke, false);
    expect(caps.supportsNotificationSync, false);
  });

  test('desktop capability constructor preserves explicit values', () {
    final caps = DesktopCapability(
      supportsGlobalOverlay: true,
      supportsTray: true,
      supportsQuickInvoke: true,
      supportsNotificationSync: true,
      platform: DesktopPlatform.macOS,
    );
    expect(caps.supportsGlobalOverlay, true);
    expect(caps.supportsTray, true);
    expect(caps.supportsQuickInvoke, true);
    expect(caps.supportsNotificationSync, true);
    expect(caps.platform, DesktopPlatform.macOS);
  });

  test('desktop capability returns fallback behavior for unavailable feature', () {
    final caps = DesktopCapability.defaultCaps();

    expect(
      caps.fallbackFor(DesktopFeature.globalOverlay),
      'open_main_window',
    );
    expect(caps.fallbackFor(DesktopFeature.quickInvoke), 'open_main_window');
  });
}
