import {
  EXPORT_SCHEMA_VERSION,
  EXPORT_SECTION_KEYS,
  type ExportSectionKey,
  type UserExportPackage,
} from './export.types';
import { userDataStore } from './user_data.store';

export class UserBatchExportService {
  export(userId: string): UserExportPackage {
    const sections = userDataStore.getSections(userId);
    const recordCounts = Object.fromEntries(
      EXPORT_SECTION_KEYS.map((key: ExportSectionKey) => [
        key,
        sections[key].length,
      ]),
    ) as Record<ExportSectionKey, number>;

    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      userId,
      sections,
      meta: { recordCounts },
    };
  }
}
