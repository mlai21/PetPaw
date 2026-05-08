class QualityWeightedGrowth {
  static const int _highQualityThreshold = 85;
  static const int _mediumQualityThreshold = 60;
  static const int _highQualityBonusExp = 8;
  static const int _mediumQualityBonusExp = 3;

  int expGain({required int baseExp, required int qualityScore}) {
    assert(baseExp >= 0);
    assert(qualityScore >= 0);

    if (qualityScore >= _highQualityThreshold) {
      return baseExp + _highQualityBonusExp;
    }
    if (qualityScore >= _mediumQualityThreshold) {
      return baseExp + _mediumQualityBonusExp;
    }
    return baseExp;
  }
}
