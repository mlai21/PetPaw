import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/features/onboarding/avatar_onboarding_page.dart';

void main() {
  Future<void> _goToStepTwo(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('generate_candidates')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('candidate_c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('next_step')));
    await tester.pumpAndSettle();
  }

  testWidgets('generates four candidates and renders candidate grid', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: AvatarOnboardingPage()));

    expect(find.text('Step 1/2 创建你的顾问分身'), findsOneWidget);
    expect(find.byKey(const Key('candidate_grid')), findsNothing);

    await tester.tap(find.byKey(const Key('generate_candidates')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('candidate_grid')), findsOneWidget);
    expect(find.byKey(const Key('candidate_c1')), findsOneWidget);
    expect(find.byKey(const Key('candidate_c2')), findsOneWidget);
    expect(find.byKey(const Key('candidate_c3')), findsOneWidget);
    expect(find.byKey(const Key('candidate_c4')), findsOneWidget);
  });

  testWidgets('next button is gated by selection state', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: AvatarOnboardingPage()));

    await tester.tap(find.byKey(const Key('generate_candidates')));
    await tester.pumpAndSettle();

    final disabledNext = tester.widget<FilledButton>(
      find.byKey(const Key('next_step')),
    );
    expect(disabledNext.onPressed, isNull);

    await tester.tap(find.byKey(const Key('candidate_c1')));
    await tester.pumpAndSettle();

    final enabledNext = tester.widget<FilledButton>(
      find.byKey(const Key('next_step')),
    );
    expect(enabledNext.onPressed, isNotNull);

    await tester.tap(find.byKey(const Key('next_step')));
    await tester.pumpAndSettle();

    expect(find.text('Step 2/2 基础信息'), findsOneWidget);
  });

  testWidgets('shows error when finishing step2 without valid name', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: AvatarOnboardingPage()));
    await _goToStepTwo(tester);

    await tester.tap(find.byKey(const Key('finish_onboarding')));
    await tester.pumpAndSettle();

    expect(find.text('请先给分身起名字'), findsOneWidget);
  });

  testWidgets('finishes when valid advisor name is provided', (tester) async {
    String? callbackCandidateId;
    String? callbackAdvisorName;
    String? callbackExpectation;

    await tester.pumpWidget(
      MaterialApp(
        home: AvatarOnboardingPage(
          onFinished: ({
            required String selectedCandidateId,
            required String advisorName,
            String? expectation,
          }) {
            callbackCandidateId = selectedCandidateId;
            callbackAdvisorName = advisorName;
            callbackExpectation = expectation;
          },
        ),
      ),
    );
    await _goToStepTwo(tester);

    await tester.enterText(
      find.byKey(const Key('advisor_name_input')),
      '分身顾问',
    );
    await tester.enterText(find.byKey(const Key('expectation_input')), '希望更懂我');
    await tester.tap(find.byKey(const Key('finish_onboarding')));
    await tester.pumpAndSettle();

    expect(find.text('请先给分身起名字'), findsNothing);
    expect(callbackCandidateId, 'c1');
    expect(callbackAdvisorName, '分身顾问');
    expect(callbackExpectation, '希望更懂我');
  });
}
