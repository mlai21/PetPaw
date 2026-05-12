class AvatarCandidate {
  const AvatarCandidate({
    required this.id,
    required this.imageUrl,
    this.previewHint = '',
  });

  final String id;
  final String imageUrl;
  final String previewHint;
}

bool validateAdvisorName(String value) {
  final trimmedValue = value.trim();
  return trimmedValue.length >= 2 && trimmedValue.length <= 12;
}
