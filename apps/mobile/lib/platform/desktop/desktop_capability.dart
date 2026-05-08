class DesktopCapability {
  DesktopCapability({
    required this.supportsGlobalOverlay,
    required this.supportsTray,
  });

  final bool supportsGlobalOverlay;
  final bool supportsTray;

  factory DesktopCapability.defaultCaps() =>
      DesktopCapability(supportsGlobalOverlay: false, supportsTray: false);
}
