import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/core/app.dart';

void main() {
  testWidgets('App boots to HomeShell', (tester) async {
    await tester.pumpWidget(const PetPawApp());
    expect(find.text('肯定昨天的自己'), findsOneWidget);
    expect(find.text('今日'), findsWidgets);
  });
}
