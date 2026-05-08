import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/personality_mode.dart';
import 'package:pet_paw_app/features/avatar/widgets/personality_selector.dart';

void main() {
  testWidgets('selector renders dropdown and triggers onChanged', (tester) async {
    PersonalityMode? selected;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PersonalitySelector(
            value: PersonalityMode.healer,
            onChanged: (mode) => selected = mode,
          ),
        ),
      ),
    );

    expect(find.byType(DropdownButton<PersonalityMode>), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<PersonalityMode>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('行动教练').last);
    await tester.pumpAndSettle();

    expect(selected, PersonalityMode.coach);
  });
}
