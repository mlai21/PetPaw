import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/platform/desktop/desktop_capability.dart';

void main() {
  test('desktop capability reports feature flags', () {
    final caps = DesktopCapability.defaultCaps();
    expect(caps.supportsGlobalOverlay, false);
    expect(caps.supportsTray, false);
  });

  test('desktop capability constructor preserves explicit values', () {
    final caps =
        DesktopCapability(supportsGlobalOverlay: true, supportsTray: true);
    expect(caps.supportsGlobalOverlay, true);
    expect(caps.supportsTray, true);
  });
}
