import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/today/today_page.dart';

void main() {
  const ctaLabel = '带着今天的状态问顾问';

  testWidgets('CTA hidden until both fields are filled', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: TodayPage(),
      ),
    );

    expect(find.text(ctaLabel), findsNothing);

    await tester.enterText(
      find.byKey(const ValueKey('today_affirm_input')),
      '感谢阳光',
    );
    await tester.pump();
    expect(find.text(ctaLabel), findsNothing);

    await tester.enterText(
      find.byKey(const ValueKey('today_challenge_input')),
      '跑 3 公里',
    );
    await tester.pump();
    expect(find.text(ctaLabel), findsOneWidget);
  });

  testWidgets('tapping CTA sends affirmation and challenge payload', (tester) async {
    Map<String, String>? received;

    await tester.pumpWidget(
      MaterialApp(
        home: TodayPage(
          onAskAdvisor: (payload) => received = Map<String, String>.from(payload),
        ),
      ),
    );

    const affirm = '感谢休息';
    const challenge = '专注工作两小时';

    await tester.enterText(
      find.byKey(const ValueKey('today_affirm_input')),
      affirm,
    );
    await tester.enterText(
      find.byKey(const ValueKey('today_challenge_input')),
      challenge,
    );
    await tester.pump();

    await tester.tap(find.text(ctaLabel));
    await tester.pump();

    expect(received, isNotNull);
    expect(received!['affirmation'], affirm);
    expect(received!['challenge'], challenge);
  });
}
