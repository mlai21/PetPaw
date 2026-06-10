import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/remote/advisor_chat_repository.dart';
import 'package:pet_paw_app/features/advisor/advisor_chat_page.dart';

class _FakeAdvisorChatRepository implements AdvisorChatRepository {
  const _FakeAdvisorChatRepository(this.reply);

  final AdvisorReply reply;

  @override
  Future<AdvisorReply> askAdvisor(
    String message, {
    bool allowSearch = false,
  }) async {
    return reply;
  }

  @override
  void dispose() {}
}

void main() {
  testWidgets('advisor page renders chat shell controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            advisorRepository: StubAdvisorChatRepository(),
          ),
        ),
      ),
    );

    expect(find.text('问问你的顾问'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
    expect(find.byIcon(Icons.mic_none_rounded), findsOneWidget);
    expect(find.byIcon(Icons.add), findsOneWidget);
  });

  testWidgets(
      'advisor page streams in hybrid mode: 220ms skeleton then two-speed ticks',
      (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            advisorRepository: StubAdvisorChatRepository(),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '我今天该先做什么？');
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pump();

    expect(find.text('思考中...'), findsOneWidget);
    expect(
      find.text('收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。'),
      findsNothing,
    );

    // 前 220ms 展示“思考中...”阶段。
    await tester.pump(const Duration(milliseconds: 220));
    final planningVisible = find.text('思考中...').evaluate().isNotEmpty;
    final composingVisible = find.text('整理回复中...').evaluate().isNotEmpty;
    expect(planningVisible || composingVisible, isTrue);

    // 进入流式补全阶段，最终应能呈现完整回复。
    await tester.pump(const Duration(milliseconds: 220));

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
          body: AdvisorChatPage(
            advisorRepository: StubAdvisorChatRepository(),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '第一个问题');
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pump();

    await tester.pump(const Duration(milliseconds: 320));

    await tester.enterText(find.byType(TextField), '第二个问题');
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pump();

    expect(find.text('第一个问题'), findsOneWidget);
    expect(find.text('第二个问题'), findsOneWidget);
    expect(find.text('思考中...'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();

    // 第一轮流式应被打断，最终仅最新会话完成。
    expect(
      find.text('收到，我来帮你拆解。先从最小行动开始：把任务缩小到10分钟内可完成的一步。'),
      findsOneWidget,
    );
    expect(find.text('思考中...'), findsNothing);

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
            advisorRepository: const StubAdvisorChatRepository(),
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
        home: const Scaffold(
          body: AdvisorChatPage(
            advisorRepository: StubAdvisorChatRepository(),
          ),
        ),
      ),
    );

    final messageBubbleFinder = find
        .ancestor(
          of: find.text('问问你的顾问'),
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is Container && widget.decoration is BoxDecoration,
          ),
        )
        .first;
    final bubbleContainer = tester.widget<Container>(messageBubbleFinder);
    final bubbleDecoration = bubbleContainer.decoration! as BoxDecoration;

    expect(bubbleDecoration.color, darkTheme.colorScheme.surfaceContainerLow);
    expect(bubbleDecoration.color, isNot(Colors.white));
  });

  testWidgets('advisor message renders web links from backend reply', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            advisorRepository: _FakeAdvisorChatRepository(
              AdvisorReply(
                answer: '北京今日天气晴，最高约28℃，最低约19℃。',
                model: 'qwen3.5-flash',
                route: 'dashscope',
                llmOk: true,
                tasks: [],
                completedTaskIds: [],
                webLinks: [
                  AdvisorWebLink(
                    taskId: 'task-1',
                    tool: 'bailian-search',
                    title: '中国天气网北京预报',
                    url: 'https://www.weather.com.cn/beijing/forecast.html',
                  ),
                ],
                thinkingSteps: [],
                thinkingTotalMs: 0,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '今天北京天气气温多少');
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2600));
    await tester.pumpAndSettle();

    expect(find.textContaining('参考网页链接：'), findsOneWidget);
    expect(
      find.textContaining('https://www.weather.com.cn/beijing/forecast.html'),
      findsOneWidget,
    );
  });

  testWidgets('advisor message renders markdown and removes duplicated web links section', (
    tester,
  ) async {
    const link = 'https://example.com/a';
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AdvisorChatPage(
            advisorRepository: _FakeAdvisorChatRepository(
              AdvisorReply(
                answer: '''
**结论**：先做 10 分钟版本。

- 第一步：打开任务清单
- 第二步：执行最小动作

参考网页链接：
- 示例链接: https://example.com/a
''',
                model: 'qwen3.5-flash',
                route: 'dashscope',
                llmOk: true,
                tasks: [],
                completedTaskIds: [],
                webLinks: [
                  AdvisorWebLink(
                    taskId: 'task-1',
                    tool: 'bailian-search',
                    title: '示例链接',
                    url: link,
                  ),
                ],
                thinkingSteps: [],
                thinkingTotalMs: 0,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '给我一个执行建议');
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2800));
    await tester.pumpAndSettle();

    expect(find.byType(MarkdownBody), findsWidgets);
    expect(find.textContaining('结论', findRichText: true), findsOneWidget);
    expect(find.textContaining('参考网页链接：'), findsOneWidget);
    expect(find.textContaining(link), findsOneWidget);
  });
}
