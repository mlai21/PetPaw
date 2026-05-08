import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/platform/desktop/desktop_capability.dart';

void main() {
  test('desktop capability reports feature flags', () {
    final caps = DesktopCapability.defaultCaps();
    expect(caps.supportsGlobalOverlay, false);
  });
}
