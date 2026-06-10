import {
  EXPORT_SECTION_KEYS,
  type ExportSectionKey,
  type ExportSections,
} from './export.types';

type SectionSeed = Partial<Record<ExportSectionKey, unknown[]>>;

function emptySections(): ExportSections {
  const sections = {} as ExportSections;
  for (const key of EXPORT_SECTION_KEYS) {
    sections[key] = [];
  }
  return sections;
}

class UserDataStore {
  private readonly byUser = new Map<string, ExportSections>();

  reset() {
    this.byUser.clear();
  }

  seed(userId: string, sections: SectionSeed) {
    const merged = emptySections();
    for (const key of EXPORT_SECTION_KEYS) {
      merged[key] = [...(sections[key] ?? [])];
    }
    this.byUser.set(userId, merged);
  }

  getSections(userId: string): ExportSections {
    const existing = this.byUser.get(userId);
    if (!existing) {
      return emptySections();
    }
    const copy = emptySections();
    for (const key of EXPORT_SECTION_KEYS) {
      copy[key] = [...existing[key]];
    }
    return copy;
  }
}

export const userDataStore = new UserDataStore();
