import 'package:pet_paw_app/features/onboarding/avatar_onboarding_models.dart';

abstract class AvatarOnboardingRepository {
  Future<List<AvatarCandidate>> generateCandidates({
    required List<String> localImagePaths,
    required String style,
  });
}
