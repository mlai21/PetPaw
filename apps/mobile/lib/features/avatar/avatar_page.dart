import 'package:flutter/material.dart';
import 'package:pet_paw_app/features/avatar/widgets/evolution_toggle.dart';

class AvatarPage extends StatefulWidget {
  const AvatarPage({super.key});

  @override
  State<AvatarPage> createState() => _AvatarPageState();
}

class _AvatarPageState extends State<AvatarPage> {
  bool _paused = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Avatar')),
      body: EvolutionToggle(
        paused: _paused,
        onChanged: (value) => setState(() => _paused = value),
      ),
    );
  }
}
