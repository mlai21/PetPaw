import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/advisor/advisor_chat_page.dart';

void main() {
  testWidgets('advisor page renders welcome guide and suggestion chips', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(),
        ),
      ),
    );

    expect(find.text('问问你的顾问'), findsOneWidget);
    expect(find.text('你可以这样开始：'), findsOneWidget);
    expect(find.text('帮我拆解今天最重要的一步'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('发送'), findsOneWidget);
  });

  testWidgets(
    'advisor page shows today context guide and back button when provided',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdvisorChatPage(
              fromTodayContext: const {'affirmation': 'x', 'challenge': 'y'},
              onBackToToday: () {},
            ),
          ),
        ),
      );

      expect(
        find.text(
          '我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？',
        ),
        findsOneWidget,
      );
      expect(find.text('返回今日'), findsOneWidget);
      expect(find.text('你可以这样开始：'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    },
  );

  testWidgets('back to today button invokes callback', (tester) async {
    var backTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            fromTodayContext: const {'challenge': 'focus'},
            onBackToToday: () => backTapped = true,
          ),
        ),
      ),
    );

    await tester.tap(find.text('返回今日'));
    expect(backTapped, isTrue);
  });

  testWidgets('advisor page hides today context guide when context is empty', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(fromTodayContext: {}),
        ),
      ),
    );

    expect(
      find.text('我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？'),
      findsNothing,
    );
    expect(find.text('返回今日'), findsNothing);
  });

  testWidgets('advisor page hides back button when callback is null', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(fromTodayContext: {'challenge': 'focus'}),
        ),
      ),
    );

    expect(
      find.text('我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？'),
      findsOneWidget,
    );
    expect(find.text('返回今日'), findsNothing);
  });

  testWidgets('advisor page shows thinking state before reply', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '我今天该先做什么？');
    await tester.tap(find.text('发送'));
    await tester.pump();

    expect(find.text('思考中...'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 900));
    await tester.pumpAndSettle();

    expect(find.text('思考中...'), findsNothing);
    expect(find.text('收到，我来帮你拆解。'), findsOneWidget);
  });
}
