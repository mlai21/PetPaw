class AvatarState {
  AvatarState({
    required this.level,
    required this.exp,
    required this.evolutionStage,
    required this.streakDays,
    required this.evolutionPaused,
  });

  final int level;
  final int exp;
  final int evolutionStage;
  final int streakDays;
  final bool evolutionPaused;
}
