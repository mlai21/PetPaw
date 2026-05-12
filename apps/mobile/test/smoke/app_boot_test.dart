import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';
import 'package:pet_paw_app/data/remote/advisor_chat_repository.dart';

void main() {
  testWidgets('App boots to HomeShell', (tester) async {
    await tester.pumpWidget(
      const PetPawApp(advisorRepository: const StubAdvisorChatRepository()),
    );
    expect(find.text('肯定昨天的自己'), findsOneWidget);
    expect(find.text('今日'), findsWidgets);
    expect(find.byType(BottomNavigationBar), findsOneWidget);
  });
}
