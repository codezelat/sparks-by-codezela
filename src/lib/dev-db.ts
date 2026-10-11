import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir } from 'node:fs/promises';
import type { Query } from './db';
let connection: Promise<Query> | undefined;
export function developmentDatabase(): Promise<Query> {
  if (connection) return connection;
  connection = (async () => {
    await mkdir('.local', { recursive: true });
    const db = new PGlite('.local/postgres');
    await db.exec(await readFile('migrations/001-content.sql', 'utf8'));
    const kind = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='articles' AND column_name='kind'",
    );
    if (!kind.rows.length)
      await db.exec(await readFile('migrations/003-pages.sql', 'utf8'));
    const count = await db.query<{ count: string }>(
      'SELECT count(*) FROM articles',
    );
    if (Number(count.rows[0].count) === 0) {
      const { default: snapshot } = await import('../data/ghost-snapshot.json');
      await db.transaction(async (tx) => {
        for (const p of [...snapshot.posts, ...snapshot.pages])
          await tx.query(
            'INSERT INTO articles(id,slug,published,published_at,updated_at,kind) VALUES($1,$2,$3::jsonb,$4,$5,$6)',
            [
              p.id,
              p.slug,
              JSON.stringify(p),
              p.publishedAt,
              p.updatedAt,
              p.kind,
            ],
          );
      });
    }
    return async <T extends Record<string, any>>(
      text: string,
      params: any[] = [],
    ) => (await db.query<T>(text, params)).rows;
  })();
  return connection;
}
