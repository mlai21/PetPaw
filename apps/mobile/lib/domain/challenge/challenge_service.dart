enum ChallengeSource { manifesto, custom }

class ChallengeItem {
  ChallengeItem(this.title, this.source);

  final String title;
  final ChallengeSource source;
}

class ChallengeService {
  List<ChallengeItem> suggestFromPlan(List<String> planItems) {
    return planItems
        .map((item) => ChallengeItem(item, ChallengeSource.manifesto))
        .toList();
  }
}
