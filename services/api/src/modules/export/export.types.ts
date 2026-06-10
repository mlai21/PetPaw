export const EXPORT_SCHEMA_VERSION = '1.0';

export const EXPORT_SECTION_KEYS = [
  'daily_entries',
  'manifestos',
  'challenges',
  'monthly_reviews',
  'advisor_memory',
  'avatar_profile',
  'avatar_growth_state',
  'avatar_energy_state',
  'avatar_unlocks',
] as const;

export type ExportSectionKey = (typeof EXPORT_SECTION_KEYS)[number];

export type ExportSections = Record<ExportSectionKey, unknown[]>;

export type UserExportPackage = {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  userId: string;
  sections: ExportSections;
  meta: {
    recordCounts: Record<ExportSectionKey, number>;
  };
};
