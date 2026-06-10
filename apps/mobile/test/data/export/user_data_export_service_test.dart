import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/export/local_user_data_export_source.dart';
import 'package:pet_paw_app/data/export/user_data_export_service.dart';

void main() {
  test('buildExportPackage includes all required sections', () async {
    final service = UserDataExportService(
      LocalUserDataExportSource(
        overrides: {
          'daily_entries': [
            {'id': 'd1', 'date': '2026-05-01'},
          ],
          'manifestos': [],
        },
      ),
    );

    final pkg = await service.buildExportPackage(userId: 'u-test');

    expect(pkg['schemaVersion'], '1.0');
    expect(pkg['userId'], 'u-test');
    expect(pkg['exportedAt'], isA<String>());
    final sections = pkg['sections'] as Map<String, dynamic>;
    expect(sections['daily_entries'], hasLength(1));
    expect(sections['manifestos'], isEmpty);
    expect(sections.keys, containsAll(LocalUserDataExportSource.requiredSectionKeys));
    final counts = pkg['meta']['recordCounts'] as Map<String, dynamic>;
    expect(counts['daily_entries'], 1);
    expect(counts['manifestos'], 0);
  });

  test('mergeRemotePackage combines local and remote section lists', () async {
    final service = UserDataExportService(
      const LocalUserDataExportSource(),
    );

    final merged = await service.buildExportPackage(
      userId: 'u-merge',
      remotePackage: {
        'sections': {
          'daily_entries': [
            {'id': 'remote-1'},
          ],
          'challenges': [
            {'id': 'c-remote'},
          ],
        },
      },
    );

    final sections = merged['sections'] as Map<String, dynamic>;
    expect(sections['daily_entries'], hasLength(1));
    expect((sections['daily_entries'] as List).first['id'], 'remote-1');
    expect(sections['challenges'], hasLength(1));
    expect(sections['manifestos'], isEmpty);
  });
}
