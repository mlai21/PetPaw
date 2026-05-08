class AvatarGrowthState {
  AvatarGrowthState({
    required this.level,
    required this.exp,
    required this.stage,
    required this.streakDays,
    required this.paused,
  });

  final int level;
  final int exp;
  final int stage;
  final int streakDays;
  final bool paused;
}

class AvatarGrowthEngine {
  AvatarGrowthState onChallengeCompleted(AvatarGrowthState state) {
    final streak = state.streakDays + 1;
    final stage = (!state.paused && streak >= 7) ? state.stage + 1 : state.stage;
    return AvatarGrowthState(
      level: state.level,
      exp: state.exp + 10,
      stage: stage,
      streakDays: streak,
      paused: state.paused,
    );
  }
}
