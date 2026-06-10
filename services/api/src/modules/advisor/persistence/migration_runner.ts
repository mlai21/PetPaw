import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 解析 migrations 目录。优先用编译/运行目录下的 migrations，
 * 若不存在（例如 tsc 未拷贝 .sql 到 dist 时）回退到源码目录，保证生产可用。
 */
function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(process.cwd(), 'src/modules/advisor/persistence/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export function runMigrations(db: Database.Database): void {
  db.prepare(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  ).run();
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>).map(
      (r) => r.version,
    ),
  );
  const migrationsDir = resolveMigrationsDir();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const insertVersion = db.prepare(
    'INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)',
  );
  const tx = db.transaction((pending: string[]) => {
    for (const file of pending) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      insertVersion.run(version, Date.now());
    }
  });
  tx(files);
}
