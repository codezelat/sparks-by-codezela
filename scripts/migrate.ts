import { neon } from '@neondatabase/serverless';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.env.DATABASE_URL)
  throw new Error(
    'Set DATABASE_URL in .env before running the Neon migration.',
  );
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
for (const name of (await readdir('migrations'))
  .filter((n) => n.endsWith('.sql'))
  .sort()) {
  const content = await readFile(`migrations/${name}`, 'utf8');
  const checksum = createHash('sha256').update(content).digest('hex');
  const applied =
    await sql`SELECT checksum FROM schema_migrations WHERE name=${name}`;
  if (applied[0]) {
    if (applied[0].checksum !== checksum)
      throw new Error(`Applied migration changed: ${name}`);
    continue;
  }
  const statements = content
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement, [])),
    sql`INSERT INTO schema_migrations(name,checksum) VALUES(${name},${checksum})`,
  ]);
  console.log(`Applied ${name}`);
}
console.log('Schema migration complete.');
