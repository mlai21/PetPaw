import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/data/local/app_database.dart';

void main() {
  test('database contains required tables', () {
    final names = AppDatabase.requiredTableNames;
    expect(
      names,
      containsAll(['daily_entries', 'manifestos', 'avatar_growth_state']),
    );
  });
}
