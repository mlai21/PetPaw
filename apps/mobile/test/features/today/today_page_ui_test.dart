import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/today/today_page.dart';

void main() {
  testWidgets('today page shows advisor CTA only after two inputs are filled', (
    tester,
  ) async {
    Map<String, String>? emitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TodayPage(
            onAskAdvisor: (payload) => emitted = payload,
          ),
        ),
      ),
    );

    expect(find.text('带着今天的状态问顾问'), findsNothing);
    await tester.enterText(find.byKey(const Key('today_affirm_input')), '谢谢昨天坚持的自己');
    await tester.enterText(find.byKey(const Key('today_challenge_input')), '今晚完成30分钟深度工作');
    await tester.pump();

    expect(find.text('带着今天的状态问顾问'), findsOneWidget);
    await tester.tap(find.text('带着今天的状态问顾问'));
    await tester.pump();
    expect(emitted?['affirmation'], contains('昨天'));
    expect(emitted?['challenge'], contains('深度工作'));
  });
}
