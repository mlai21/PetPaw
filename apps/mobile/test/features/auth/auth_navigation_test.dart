import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';
import 'package:pet_paw_app/data/remote/advisor_chat_repository.dart';

void main() {
  testWidgets('settings -> login -> register -> submit opens avatar onboarding', (
    tester,
  ) async {
    await tester.pumpWidget(
      const PetPawApp(advisorRepository: const StubAdvisorChatRepository()),
    );

    await tester.tap(find.byIcon(Icons.settings));
    await tester.pumpAndSettle();

    await tester.tap(find.text('账户登录'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login_phone')), findsOneWidget);
    expect(find.byKey(const Key('login_code')), findsOneWidget);
    expect(find.text('欢迎回来'), findsOneWidget);

    await tester.tap(find.byKey(const Key('login_go_register')));
    await tester.pumpAndSettle();

    expect(find.text('创建账号'), findsOneWidget);
    expect(find.byKey(const Key('register_phone')), findsOneWidget);
    expect(find.byKey(const Key('register_code')), findsOneWidget);

    await tester.enterText(find.byKey(const Key('register_phone')), '13800138000');
    await tester.enterText(find.byKey(const Key('register_code')), '123456');
    await tester.tap(find.byKey(const Key('register_submit')));
    await tester.pumpAndSettle();

    expect(find.text('Step 1/2 创建你的顾问分身'), findsOneWidget);
  });
}
