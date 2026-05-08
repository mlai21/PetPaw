import 'package:flutter/material.dart';

class EvolutionToggle extends StatelessWidget {
  const EvolutionToggle({
    required this.paused,
    required this.onChanged,
    super.key,
  });

  final bool paused;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: paused,
      onChanged: onChanged,
      title: const Text('Pause evolution'),
    );
  }
}
