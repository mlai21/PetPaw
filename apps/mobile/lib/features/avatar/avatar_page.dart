import 'package:flutter/material.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';
import 'package:pet_paw_app/features/avatar/widgets/evolution_toggle.dart';
import 'package:pet_paw_app/features/avatar/widgets/personality_selector.dart';

class AvatarPage extends StatefulWidget {
  const AvatarPage({super.key});

  @override
  State<AvatarPage> createState() => _AvatarPageState();
}

class _AvatarPageState extends State<AvatarPage> {
  bool _paused = false;
  PersonalityMode _mode = PersonalityMode.coach;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('分身成长状态', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            title: const Text('人格模式'),
            subtitle: Text(_mode.promptPrefix()),
            trailing: PersonalitySelector(
              value: _mode,
              onChanged: (mode) => setState(() => _mode = mode),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: EvolutionToggle(
              paused: _paused,
              onChanged: (value) => setState(() => _paused = value),
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: ListTile(
            title: Text('能量与连胜'),
            subtitle: Text('当前能量 78 / 连续行动 6 天 / 进化阶段 2'),
          ),
        ),
      ],
    );
  }
}
