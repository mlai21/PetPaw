import 'package:flutter/material.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';

class PersonalitySelector extends StatelessWidget {
  const PersonalitySelector({
    required this.value,
    required this.onChanged,
    super.key,
  });

  final PersonalityMode value;
  final ValueChanged<PersonalityMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButton<PersonalityMode>(
      value: value,
      onChanged: (next) {
        if (next != null) {
          onChanged(next);
        }
      },
      items: PersonalityMode.values.map((mode) {
        return DropdownMenuItem<PersonalityMode>(
          value: mode,
          child: Text(mode.name),
        );
      }).toList(),
    );
  }
}
