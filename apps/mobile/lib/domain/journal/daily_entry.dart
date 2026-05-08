class DailyEntry {
  DailyEntry({
    required this.date,
    required this.affirmYesterday,
    required this.gratitudeItems,
    required this.positiveObservations,
    required this.todayChallenges,
    this.optionalSummary,
  });

  final String date;
  final String affirmYesterday;
  final List<String> gratitudeItems;
  final List<String> positiveObservations;
  final List<String> todayChallenges;
  final String? optionalSummary;
}
