import {
  AvatarConfigCompatibility,
  AvatarConfigSyncSummary,
} from './avatar_config_contract.types';

export class AvatarConfigContractService {
  private static readonly CURRENT_VERSION = 'v1';
  private static readonly MIN_SUPPORTED_VERSION = 'v1';
  private static readonly PROMPT_KEYS = ['healer', 'coach', 'strategist'];

  getSyncSummary(): AvatarConfigSyncSummary {
    return {
      currentVersion: AvatarConfigContractService.CURRENT_VERSION,
      supportedMinVersion: AvatarConfigContractService.MIN_SUPPORTED_VERSION,
      promptKeys: [...AvatarConfigContractService.PROMPT_KEYS],
    };
  }

  checkCompatibility(clientVersion: string): AvatarConfigCompatibility {
    const compatible =
      clientVersion === AvatarConfigContractService.CURRENT_VERSION;
    return {
      compatible,
      recommendedVersion: AvatarConfigContractService.CURRENT_VERSION,
    };
  }
}
