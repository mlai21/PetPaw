import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';

void main() {
  testWidgets('settings account row opens login and can navigate to register', (
    tester,
  ) async {
    await tester.pumpWidget(const PetPawApp());

    await tester.tap(find.byIcon(Icons.settings));
    await tester.pumpAndSettle();

    await tester.tap(find.text('账户登录'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login_email')), findsOneWidget);
    expect(find.text('欢迎回来'), findsOneWidget);

    await tester.tap(find.byKey(const Key('login_go_register')));
    await tester.pumpAndSettle();

    expect(find.text('创建账号'), findsOneWidget);
    expect(find.byKey(const Key('register_email')), findsOneWidget);

    await tester.tap(find.byKey(const Key('register_go_login')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login_email')), findsOneWidget);
  });
}
