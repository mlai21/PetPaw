import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/modules/advisor/persistence/migration_runner';

describe('migration_runner', () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-migrate-')), 'test.db');
  });

  it('creates all 6 tables on first run', () => {
    const db = new Database(dbPath);
    runMigrations(db);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as Array<{ name: string }>;
    const names = new Set(tables.map((t) => t.name));
    expect(names.has('advisor_sessions')).toBe(true);
    expect(names.has('advisor_runtimes')).toBe(true);
    expect(names.has('advisor_tasks')).toBe(true);
    expect(names.has('advisor_stage_traces')).toBe(true);
    expect(names.has('advisor_policies')).toBe(true);
    expect(names.has('schema_migrations')).toBe(true);
    db.close();
  });

  it('is idempotent (second run does not error)', () => {
    const db = new Database(dbPath);
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    db.close();
  });
});
