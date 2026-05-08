class QualityWeightedGrowth {
  int expGain({required int baseExp, required int qualityScore}) {
    if (qualityScore >= 85) return baseExp + 8;
    if (qualityScore >= 60) return baseExp + 3;
    return baseExp;
  }
}
