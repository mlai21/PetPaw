import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';

void main() {
  testWidgets('home shell shows requested tabs and can switch to settings', (
    tester,
  ) async {
    await tester.pumpWidget(const PetPawApp());

    expect(find.text('今日'), findsWidgets);
    expect(find.text('宣言书'), findsOneWidget);
    expect(find.text('顾问'), findsOneWidget);
    expect(find.text('历史记录'), findsOneWidget);
    expect(find.text('设置'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings));
    await tester.pumpAndSettle();

    expect(find.text('分身形象管理'), findsOneWidget);
    expect(find.text('账户登录'), findsOneWidget);
  });

  testWidgets('floating pet is hidden on settings tab only', (tester) async {
    await tester.pumpWidget(const PetPawApp());

    expect(find.byKey(const Key('floating_pet')), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('floating_pet')), findsNothing);
  });

  testWidgets('floating pet can be dragged to a new position', (tester) async {
    await tester.pumpWidget(const PetPawApp());
    await tester.pump(const Duration(milliseconds: 200));

    final petFinder = find.byKey(const Key('floating_pet'));
    final before = tester.getTopLeft(petFinder);

    await tester.drag(petFinder, const Offset(-80, -120));
    await tester.pump(const Duration(milliseconds: 200));

    final after = tester.getTopLeft(petFinder);
    expect(after.dx, lessThan(before.dx));
    expect(after.dy, lessThan(before.dy));
  });

  testWidgets(
    'tapping floating pet does not navigate to advisor guidance',
    (tester) async {
      await tester.pumpWidget(const PetPawApp());
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('今日'), findsWidgets);
      expect(find.text('你可以这样开始：'), findsNothing);
      expect(find.text('问问你的顾问'), findsNothing);

      await tester.tap(find.byKey(const Key('floating_pet')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('今日'), findsWidgets);
      expect(find.text('你可以这样开始：'), findsNothing);
      expect(find.text('问问你的顾问'), findsNothing);
    },
  );

  testWidgets('today can jump to advisor and back', (tester) async {
    await tester.pumpWidget(const PetPawApp());

    await tester.enterText(
      find.byKey(const ValueKey('today_affirm_input')),
      '感谢今天阳光很好',
    );
    await tester.enterText(
      find.byKey(const ValueKey('today_challenge_input')),
      '把最难任务先启动10分钟',
    );
    await tester.pump();

    await tester.tap(find.text('带着今天的状态问顾问'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('返回今日'), findsOneWidget);

    await tester.tap(find.text('返回今日'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.byKey(const ValueKey('today_affirm_input')), findsOneWidget);
    expect(find.byKey(const ValueKey('today_challenge_input')), findsOneWidget);
  });

  testWidgets('manual advisor tab clears stale today context', (tester) async {
    await tester.pumpWidget(const PetPawApp());

    await tester.enterText(
      find.byKey(const ValueKey('today_affirm_input')),
      '感谢按时休息',
    );
    await tester.enterText(
      find.byKey(const ValueKey('today_challenge_input')),
      '先完成最困难的任务',
    );
    await tester.pump();

    await tester.tap(find.text('带着今天的状态问顾问'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('返回今日'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.wb_sunny));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const ValueKey('today_affirm_input')), findsOneWidget);

    await tester.tap(find.byIcon(Icons.chat_bubble));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('返回今日'), findsNothing);
  });
}
