import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/export/local_user_data_export_source.dart';
import 'package:pet_paw_app/data/export/user_data_export_service.dart';
import 'package:pet_paw_app/features/settings/data_export_page.dart';

void main() {
  testWidgets('shows section preview and export button after load', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: DataExportPage(
          userId: 'u-ui',
          includeRemote: false,
          exportService: UserDataExportService(
            LocalUserDataExportSource(
              overrides: {
                'daily_entries': [
                  {'id': 'd-ui'},
                ],
              },
            ),
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('daily_entries'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    final exportTarget = find.byKey(const Key('data_export_button'));
    await tester.scrollUntilVisible(exportTarget, 120);
    expect(exportTarget, findsOneWidget);
    expect(find.text('导出并复制 JSON'), findsOneWidget);
  });
}
