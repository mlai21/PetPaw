enum DesktopPlatform { macOS, windows }

enum DesktopFeature {
  globalOverlay,
  tray,
  quickInvoke,
  notificationSync,
}

class DesktopCapability {
  DesktopCapability({
    required this.supportsGlobalOverlay,
    required this.supportsTray,
    required this.supportsQuickInvoke,
    required this.supportsNotificationSync,
    required this.platform,
  });

  final bool supportsGlobalOverlay;
  final bool supportsTray;
  final bool supportsQuickInvoke;
  final bool supportsNotificationSync;
  final DesktopPlatform platform;

  factory DesktopCapability.defaultCaps() => DesktopCapability(
    supportsGlobalOverlay: false,
    supportsTray: false,
    supportsQuickInvoke: false,
    supportsNotificationSync: false,
    platform: DesktopPlatform.macOS,
  );

  bool supports(DesktopFeature feature) {
    switch (feature) {
      case DesktopFeature.globalOverlay:
        return supportsGlobalOverlay;
      case DesktopFeature.tray:
        return supportsTray;
      case DesktopFeature.quickInvoke:
        return supportsQuickInvoke;
      case DesktopFeature.notificationSync:
        return supportsNotificationSync;
    }
  }

  String fallbackFor(DesktopFeature feature) {
    if (supports(feature)) {
      return 'native_support';
    }
    return 'open_main_window';
  }
}
