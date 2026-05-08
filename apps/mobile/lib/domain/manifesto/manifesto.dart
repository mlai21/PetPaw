class ManifestoGoal {
  ManifestoGoal({
    required this.goal,
    required this.executionPlan,
    required this.reward,
    required this.status,
  });

  final String goal;
  final String executionPlan;
  final String reward;
  final String status;
}

class Manifesto {
  Manifesto({
    required this.id,
    required this.createdAt,
    required this.goals,
  });

  final String id;
  final String createdAt;
  final List<ManifestoGoal> goals;
}
