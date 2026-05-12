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

  testWidgets('advisor page streams in hybrid mode: 220ms skeleton then two-speed ticks', (
    tester,
  ) async {
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

    expect(find.text('收到，我来帮你拆解。'), findsOneWidget);
    expect(
      find.text('收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。'),
      findsNothing,
    );

    // 前 220ms 保持骨架句，确保“先骨架”阶段用户可感知。
    await tester.pump(const Duration(milliseconds: 220));
    expect(find.text('收到，我来帮你拆解。'), findsOneWidget);
    expect(find.textContaining('收到，我来帮你拆解。先'), findsNothing);

    // 进入逐字补全阶段后，第一段应更快：18ms 出现“先”。
    await tester.pump(const Duration(milliseconds: 18));
    expect(find.text('收到，我来帮你拆解。先'), findsOneWidget);

    // 前 12 字采用快节奏（18ms/tick）。
    await tester.pump(const Duration(milliseconds: 198));
    expect(
      find.textContaining('收到，我来帮你拆解。先从最小行动开始：把任务'),
      findsOneWidget,
    );

    // 第 13 字应切到稳态（24ms/tick）。
    await tester.pump(const Duration(milliseconds: 23));
    expect(
      find.textContaining('收到，我来帮你拆解。先从最小行动开始：把任务缩'),
      findsNothing,
    );
    await tester.pump(const Duration(milliseconds: 1));
    expect(
      find.textContaining('收到，我来帮你拆解。先从最小行动开始：把任务缩'),
      findsOneWidget,
    );

    await tester.pump(const Duration(milliseconds: 2000));
    await tester.pumpAndSettle();

    expect(
      find.text('收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。'),
      findsOneWidget,
    );
  });

  testWidgets('new send interrupts current stream and starts new stream', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '第一个问题');
    await tester.tap(find.text('发送'));
    await tester.pump();

    await tester.pump(const Duration(milliseconds: 320));
    final interruptedTextFinder = find.textContaining('收到，我来帮你拆解。先');
    expect(interruptedTextFinder, findsOneWidget);
    final interruptedText = tester.widget<Text>(interruptedTextFinder).data!;

    await tester.enterText(find.byType(TextField), '第二个问题');
    await tester.tap(find.text('发送'));
    await tester.pump();

    expect(find.text('第一个问题'), findsOneWidget);
    expect(find.text('第二个问题'), findsOneWidget);
    expect(find.text('收到，我来帮你拆解。'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();

    // 第一轮流式应被打断并移除，最终仅最新会话完成。
    expect(find.text(interruptedText), findsNothing);
    expect(
      find.text('收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。'),
      findsOneWidget,
    );
    expect(find.text('收到，我来帮你拆解。'), findsNothing);

    // 清空剩余流式计时器，避免测试结束时残留 pending timer。
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();
  });

  testWidgets('advisor page renders today context guide and return button', (
    tester,
  ) async {
    var returned = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            fromTodayContext: const {
              'affirmation': '谢谢昨天的自己',
              'challenge': '今天先完成最小行动',
            },
            onBackToToday: () => returned = true,
          ),
        ),
      ),
    );

    expect(find.text('我已看到你今天的挑战方向，想先拆解执行步骤，还是先排除阻碍？'), findsOneWidget);
    expect(find.text('返回今日'), findsOneWidget);
    await tester.tap(find.text('返回今日'));
    await tester.pump();
    expect(returned, isTrue);
  });

  testWidgets('shows personalized chip for focus challenge and tap only fills input', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            fromTodayContext: {
              'affirmation': '我有能力进入心流',
              'challenge': '今天要进行2小时深度工作，减少分心',
            },
          ),
        ),
      ),
    );

    expect(find.text('帮我拆成 15 分钟起步动作'), findsOneWidget);

    await tester.tap(find.text('帮我拆成 15 分钟起步动作'));
    await tester.pump();

    final input = tester.widget<TextField>(find.byType(TextField));
    expect(input.controller?.text, '帮我拆成 15 分钟起步动作');
    expect(find.text('收到，我来帮你拆解。'), findsNothing);
  });

  testWidgets('shows fallback chip when challenge has no mapped keyword', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            fromTodayContext: {
              'affirmation': '我可以稳定推进',
              'challenge': '今天把例会纪要整理清楚',
            },
          ),
        ),
      ),
    );

    expect(find.text('结合我今天的挑战给我一个起步动作'), findsOneWidget);
  });

  testWidgets('shows personalized chip for procrastination-like challenges', (
    tester,
  ) async {
    const procrastinationChip = '先帮我识别当前最大阻碍';
    const cases = ['我有点拖延', '任务卡住了', '今天开始不了'];

    for (final challenge in cases) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdvisorChatPage(
              fromTodayContext: {
                'affirmation': '我可以稳住节奏',
                'challenge': challenge,
              },
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text(procrastinationChip), findsOneWidget);
    }
  });

  testWidgets('shows personalized chip for fitness-like challenges', (
    tester,
  ) async {
    const fitnessChip = '给我一个今天可执行的最低标准';
    const cases = ['今天要运动', '今晚跑步 3 公里', '我要恢复训练'];

    for (final challenge in cases) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdvisorChatPage(
              fromTodayContext: {
                'affirmation': '我可以按计划推进',
                'challenge': challenge,
              },
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text(fitnessChip), findsOneWidget);
    }
  });

  testWidgets('shows personalized chip for review-like challenges', (tester) async {
    const reviewChip = '先帮我列出今天最关键的1条复盘点';
    const cases = ['今晚先做复盘', '我想做今天总结'];

    for (final challenge in cases) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdvisorChatPage(
              fromTodayContext: {
                'affirmation': '我愿意诚实回看',
                'challenge': challenge,
              },
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text(reviewChip), findsOneWidget);
    }
  });

  testWidgets('advisor bubble follows dark theme color tokens', (tester) async {
    final darkTheme = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF10A37F),
        brightness: Brightness.dark,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF10A37F),
            brightness: Brightness.light,
          ),
        ),
        darkTheme: darkTheme,
        themeMode: ThemeMode.dark,
        home: const Scaffold(body: AdvisorChatPage()),
      ),
    );

    final messageBubbleFinder = find
        .ancestor(
          of: find.text('问问你的顾问'),
          matching: find.byWidgetPredicate(
            (widget) => widget is Container && widget.decoration is BoxDecoration,
          ),
        )
        .first;
    final bubbleContainer = tester.widget<Container>(messageBubbleFinder);
    final bubbleDecoration = bubbleContainer.decoration! as BoxDecoration;

    expect(bubbleDecoration.color, darkTheme.colorScheme.surfaceContainerHighest);
    expect(bubbleDecoration.color, isNot(Colors.white));
  });
}
