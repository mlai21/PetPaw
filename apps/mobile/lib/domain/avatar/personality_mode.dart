import 'package:pet_paw_app/domain/avatar/avatar_play_config.dart';

enum PersonalityMode { healer, coach, strategist }

extension PersonalityModePrompt on PersonalityMode {
  String promptPrefix({AvatarPlayConfig? config}) {
    final playConfig = config ?? AvatarPlayConfig.defaults();
    return playConfig.prompts[name] ?? '';
  }
}
