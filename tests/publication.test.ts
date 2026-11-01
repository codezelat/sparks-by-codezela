import { describe, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { RuntimeCache } from '@vercel/functions';
import {
  createPublicationCache,
  PUBLICATION_TTL,
} from '../src/lib/publication-cache';
import { publicationView } from '../src/lib/publication-view';
import { articleInput, prepareArticle, type Article } from '../src/lib/content';
import { repository } from '../src/lib/repository';

function memoryCache() {
  const entries = new Map<string, unknown>();
  const cache: RuntimeCache = {
    get: async (key) => entries.get(key) ?? null,
    set: async (key, value) => {
      entries.set(key, value);
    },
    delete: async (key) => {
      entries.delete(key);
    },
    expireTag: async () => {},
  };
  return { cache, entries };
}
const article = (
  id: string,
  date = '2026-01-01T00:00:00.000Z',
  kind: 'post' | 'page' = 'post',
) =>
  prepareArticle(
    articleInput.parse({
      kind,
      title: `Google advertising ${id}`,
      slug: `post-${id}`,
      html: '<p>Search marketing and innovation.</p>',
      publishedAt: date,
      tags: ['news'],
    }),
    id,
  );

describe('Public publication cache', () => {
  it('keeps the last published site available if Neon is suspended, without repeatedly retrying SQL', async () => {
    const { cache } = memoryCache();
    let reads = 0;
    let time = Date.parse('2026-02-01');
    let unavailable = false;
    const read = async () => {
      reads++;
      if (unavailable) throw new Error('compute suspended');
      return [article('one')];
    };
    const store = createPublicationCache({
      cache,
      read,
      purge: async () => {},
      now: () => time,
    });
    await store.load();
    time += (PUBLICATION_TTL + 1) * 1000;
    unavailable = true;
    expect((await store.load()).articles[0].id).toBe('one');
    expect(store.diagnostics().source).toBe('STALE');
    await Promise.all(Array.from({ length: 100 }, () => store.load()));
    expect(reads).toBe(2);
    unavailable = false;
    await store.refresh();
    expect((await store.load()).articles[0].id).toBe('one');
  });
  it('keeps serving current content during a cache-service outage with a bounded fallback', async () => {
    const { cache } = memoryCache();
    cache.get = async () => {
      throw new Error('cache outage');
    };
    let reads = 0;
    let time = Date.parse('2026-02-01');
    const store = createPublicationCache({
      cache,
      read: async () => {
        reads++;
        return [article('one')];
      },
      purge: async () => {},
      now: () => time,
    });
    await Promise.all(Array.from({ length: 100 }, () => store.load()));
    expect(reads).toBe(1);
    expect(store.diagnostics().source).toBe('BYPASS');
    time += 31000;
    expect((await store.load()).articles[0].id).toBe('one');
    expect(reads).toBe(2);
  });
  it('shares one SQL load across concurrent pages, regions and search queries for six hours', async () => {
    const { cache } = memoryCache();
    let reads = 0;
    let time = Date.parse('2026-02-01');
    const read = async () => {
      reads++;
      return [article('one')];
    };
    const first = createPublicationCache({
      cache,
      read,
      purge: async () => {},
      now: () => time,
    });
    await Promise.all(Array.from({ length: 100 }, () => first.load()));
    const anotherFunction = createPublicationCache({
      cache,
      read,
      purge: async () => {},
      now: () => time,
    });
    const snapshot = await anotherFunction.load();
    const view = publicationView(snapshot.articles, () => time);
    for (let i = 0; i < 100; i++) {
      view.get('post-one');
      view.list({ search: `marketing ${i}` });
      view.urls();
    }
    expect(reads).toBe(1);
    let cacheReads = 0;
    const coldCache = {
      ...cache,
      get: async (key: string) => {
        cacheReads++;
        return cache.get(key);
      },
    };
    const coldBurst = createPublicationCache({
      cache: coldCache,
      read,
      purge: async () => {},
      now: () => time,
    });
    await Promise.all(Array.from({ length: 100 }, () => coldBurst.load()));
    expect(cacheReads).toBe(2); // One pointer and one compressed data part.
    expect(reads).toBe(1);
    time += (PUBLICATION_TTL + 1) * 1000;
    await anotherFunction.load();
    expect(reads).toBe(2);
  });

  it('refreshes after real Postgres publishing/unpublishing but never caches drafts', async () => {
    const db = new PGlite();
    try {
      for (const path of ['001-content', '003-pages', '004-editor-history'])
        await db.exec(await readFile(`migrations/${path}.sql`, 'utf8'));
      const repo = repository(
        async (sql, params = []) => (await db.query<any>(sql, params)).rows,
      );
      const read = async () =>
        (
          await db.query<{ data: Article }>(
            'SELECT published AS data FROM articles WHERE published IS NOT NULL ORDER BY published_at DESC,id',
          )
        ).rows.map((row) => row.data);
      const { cache } = memoryCache();
      let purges = 0;
      const store = createPublicationCache({
        cache,
        read,
        purge: async () => {
          purges++;
        },
      });
      await repo.save(article('one'), 0, 'publish', 'tester');
      await repo.save(article('private'), 0, 'draft', 'tester');
      expect((await store.load()).articles.map((p) => p.id)).toEqual(['one']);
      await repo.save(
        { ...article('one'), title: 'Private draft wording' },
        1,
        'draft',
        'tester',
      );
      expect(
        publicationView((await store.load()).articles).get('post-one')?.title,
      ).toBe('Google advertising one');
      await repo.save(
        { ...article('one'), title: 'Updated public wording' },
        2,
        'publish',
        'tester',
      );
      await store.refresh();
      const coldFunction = createPublicationCache({
        cache,
        read,
        purge: async () => {},
      });
      expect(
        publicationView((await coldFunction.load()).articles).get('post-one')
          ?.title,
      ).toBe('Updated public wording');
      await repo.unpublish('one', 3, 'tester');
      await store.refresh();
      expect((await coldFunction.load()).articles).toEqual([]);
      expect(purges).toBe(2);
    } finally {
      await db.close();
    }
  }, 30000);

  it('filters scheduled content at read time and caps HTML cache at the publication boundary', async () => {
    let time = Date.parse('2026-02-01T00:00:00Z');
    const { cache } = memoryCache();
    const store = createPublicationCache({
      cache,
      read: async () => [
        article('future', '2026-02-01T00:00:20.000Z'),
        article('about', '2026-01-01T00:00:00.000Z', 'page'),
        article('one'),
      ],
      purge: async () => {},
      now: () => time,
    });
    const view = publicationView((await store.load()).articles, () => time);
    expect(view.get('post-future')).toBeUndefined();
    expect(view.list({ search: 'future' }).total).toBe(0);
    expect(view.urls().map((row) => row.slug)).not.toContain('post-future');
    expect(view.pageUrls().map((row) => row.slug)).toEqual(['post-about']);
    expect(store.sharedMaxAge()).toBe(20);
    time += 20000;
    expect(view.get('post-future')?.id).toBe('future');
    expect(view.list({ search: 'future' }).total).toBe(1);
    expect(store.sharedMaxAge()).toBe(86400);
    expect(view.list({ tag: 'news', author: 'codezela-cc' }).total).toBe(2);
    expect(view.list().articles[0]).not.toHaveProperty('html');
  });

  it('does not let an older in-flight refresh overwrite a completed publish', async () => {
    const { cache } = memoryCache();
    let release!: () => void;
    let started!: () => void;
    const isStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    const read = async () => {
      if (first) {
        first = false;
        started();
        await blocked;
        return [article('old')];
      }
      return [article('new')];
    };
    const store = createPublicationCache({
      cache,
      read,
      purge: async () => {},
    });
    const old = store.load();
    await isStarted;
    await store.refresh();
    release();
    expect((await old).articles[0].id).toBe('new');
    expect((await store.load()).articles[0].id).toBe('new');
  });

  it('shards larger archives below cache limits and never treats a partial write as a snapshot', async () => {
    const { cache, entries } = memoryCache();
    const large = {
      ...article('large'),
      plaintext: randomBytes(1_600_000).toString('base64'),
    };
    let reads = 0;
    const read = async () => {
      reads++;
      return [large];
    };
    const first = createPublicationCache({
      cache,
      read,
      purge: async () => {},
    });
    await first.load();
    const chunks = [...entries.keys()].filter((key) =>
      key.startsWith('publication-data:'),
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const key of chunks)
      expect(Buffer.byteLength(entries.get(key) as string)).toBeLessThan(
        2_000_000,
      );
    const cold = createPublicationCache({ cache, read, purge: async () => {} });
    expect((await cold.load()).articles[0].plaintext).toBe(large.plaintext);
    expect(reads).toBe(1);
    entries.delete(chunks[0]);
    const broken = createPublicationCache({
      cache,
      read,
      purge: async () => {},
    });
    expect((await broken.load()).articles[0].id).toBe('large');
    expect(reads).toBe(2);
  });
});
