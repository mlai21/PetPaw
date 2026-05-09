import 'package:flutter_test/flutter_test.dart';
import 'package:pet_paw_app/domain/avatar/quality_weighted_growth.dart';

void main() {
  test('high quality completion gains more exp than low quality', () {
    final engine = QualityWeightedGrowth();
    final high = engine.expGain(baseExp: 10, qualityScore: 90);
    final low = engine.expGain(baseExp: 10, qualityScore: 40);
    expect(high, greaterThan(low));
  });

  test('exp gain matches exact and boundary quality thresholds', () {
    final engine = QualityWeightedGrowth();

    expect(engine.expGain(baseExp: 10, qualityScore: 90), 18);
    expect(engine.expGain(baseExp: 10, qualityScore: 85), 18);
    expect(engine.expGain(baseExp: 10, qualityScore: 60), 13);
    expect(engine.expGain(baseExp: 10, qualityScore: 59), 10);
  });
}
