import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';
import 'package:pet_paw_app/data/remote/advisor_chat_repository.dart';

void main() {
  testWidgets('home shell shows requested tabs and can switch to settings', (
    tester,
  ) async {
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));

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
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));

    expect(find.byKey(const Key('floating_pet')), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings));
    await tester.pump();

    expect(find.byKey(const Key('floating_pet')), findsNothing);
  });

  testWidgets('floating pet can be dragged to a new position', (tester) async {
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));
    await tester.pump(const Duration(milliseconds: 200));

    final petFinder = find.byKey(const Key('floating_pet'));
    final before = tester.getTopLeft(petFinder);

    await tester.drag(petFinder, const Offset(-520, -120));
    await tester.pump(const Duration(milliseconds: 260));

    final after = tester.getTopLeft(petFinder);
    expect(after.dx, 12);
    expect(after.dy, lessThan(before.dy));
  });

  testWidgets('floating pet snaps to horizontal edge on extreme drags', (
    tester,
  ) async {
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));
    await tester.pump(const Duration(milliseconds: 200));

    const petWidth = 104.0;
    const horizontalPadding = 12.0;
    final shellWidth = tester.getSize(find.byType(Scaffold).first).width;
    final petFinder = find.byKey(const Key('floating_pet'));

    final rightTarget = shellWidth - petWidth - horizontalPadding;

    await tester.drag(petFinder, const Offset(-520, -30));
    await tester.pump();

    final beforeLeftSnap = tester.getTopLeft(petFinder);
    expect(beforeLeftSnap.dx, greaterThan(horizontalPadding));

    await tester.pump(const Duration(milliseconds: 260));
    final leftSnapDone = tester.getTopLeft(petFinder);
    expect(leftSnapDone.dx, closeTo(horizontalPadding, 0.01));

    await tester.drag(petFinder, const Offset(800, 0));
    await tester.pump();

    final beforeRightSnap = tester.getTopLeft(petFinder);
    expect(beforeRightSnap.dx, greaterThan(rightTarget));

    await tester.pump(const Duration(milliseconds: 260));
    final rightSnapDone = tester.getTopLeft(petFinder);
    expect(rightSnapDone.dx, closeTo(rightTarget, 0.01));
  });

  testWidgets('floating pet starts snapping immediately and settles near edge', (
    tester,
  ) async {
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));
    await tester.pump(const Duration(milliseconds: 200));

    final petFinder = find.byKey(const Key('floating_pet'));

    await tester.drag(petFinder, const Offset(-520, -20));
    await tester.pump();
    final release = tester.getTopLeft(petFinder);

    await tester.pump(const Duration(milliseconds: 40));
    final during = tester.getTopLeft(petFinder);
    expect(during.dx, lessThan(release.dx));

    await tester.pump(const Duration(milliseconds: 220));
    final settled = tester.getTopLeft(petFinder);
    expect(settled.dx, lessThanOrEqualTo(12));
  });

  testWidgets('floating pet tap does not switch tab to advisor', (tester) async {
    await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));

    expect(find.text('肯定昨天的自己'), findsOneWidget);

    await tester.tap(find.byKey(const Key('floating_pet')));
    await tester.pump();

    expect(find.text('肯定昨天的自己'), findsOneWidget);
    expect(find.text('你可以这样开始：'), findsNothing);
  });

  testWidgets(
    'today completed CTA switches to advisor with context and can return to today',
    (tester) async {
      await tester.pumpWidget(const PetPawApp(advisorRepository: const StubAdvisorChatRepository()));

      await tester.enterText(
        find.byKey(const Key('today_affirm_input')),
        '昨天我完成了晨跑',
      );
      await tester.enterText(
        find.byKey(const Key('today_challenge_input')),
        '今天完成一次专注工作',
      );
      await tester.pump();
      await tester.tap(find.text('带着今天的状态问顾问'));
      await tester.pump();

      expect(
        find.text('我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？'),
        findsOneWidget,
      );
      expect(find.text('返回今日'), findsOneWidget);

      await tester.tap(find.text('返回今日'));
      await tester.pump();

      expect(find.text('肯定昨天的自己'), findsOneWidget);
      expect(find.byKey(const Key('today_affirm_input')), findsOneWidget);
    },
  );
}
