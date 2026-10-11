import { neon } from '@neondatabase/serverless';
import { mkdir, writeFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first.');
const sql = neon(process.env.DATABASE_URL);
const [articles, revisions] = await Promise.all([
  sql`SELECT * FROM articles ORDER BY id`,
  sql`SELECT * FROM revisions ORDER BY id`,
]);
await mkdir('.local/backups', { recursive: true });
const path = `.local/backups/content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(
  path,
  JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), articles, revisions },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `Saved ${articles.length} entries and ${revisions.length} revisions to ${path}. Copy this file to your backup storage.`,
);
