export type AvatarConfigSyncSummary = {
  currentVersion: string;
  supportedMinVersion: string;
  promptKeys: string[];
};

export type AvatarConfigCompatibility = {
  compatible: boolean;
  recommendedVersion: string;
};
