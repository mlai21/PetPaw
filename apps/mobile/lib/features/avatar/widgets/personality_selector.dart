import 'package:flutter/material.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';

String _modeLabel(PersonalityMode mode) {
  switch (mode) {
    case PersonalityMode.healer:
      return '疗愈者';
    case PersonalityMode.coach:
      return '行动教练';
    case PersonalityMode.strategist:
      return '策略军师';
  }
}

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
          child: Text(_modeLabel(mode)),
        );
      }).toList(),
    );
  }
}
