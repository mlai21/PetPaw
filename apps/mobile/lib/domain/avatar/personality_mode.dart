enum PersonalityMode { healer, coach, strategist }

extension PersonalityModePrompt on PersonalityMode {
  String promptPrefix() {
    switch (this) {
      case PersonalityMode.healer:
        return '以温和陪伴方式回应，优先稳定情绪';
      case PersonalityMode.coach:
        return '以行动导向方式回应，给出今天可执行的一步行动';
      case PersonalityMode.strategist:
        return '以军师方式回应，强调优先级和权衡';
    }
  }
}
