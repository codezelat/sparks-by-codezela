import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { RuntimeCache } from '@vercel/functions';
import type { Article } from './content';

export const PUBLICATION_TAG = 'sparks-public-pages-v1';
export const PUBLICATION_TTL = 6 * 3600;
export const PUBLIC_HTML_TTL = 24 * 3600;
const POINTER = 'publication-v1';
const LAST_GOOD = 'publication-last-good-v1';
const RETENTION = 30 * 86400;
type Pointer = { generation: string; expiresAt: number; parts: number };
type Snapshot = Pointer & { articles: Article[] };
class CacheStorageError extends Error {}
async function cacheIO<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch {
    throw new CacheStorageError('Publication cache storage is unavailable');
  }
}

export function createPublicationCache({
  cache,
  read,
  purge,
  now = Date.now,
}: {
  cache: RuntimeCache;
  read: () => Promise<Article[]>;
  purge: () => Promise<void>;
  now?: () => number;
}) {
  let memory: Snapshot | undefined;
  let pending: Promise<Snapshot> | undefined;
  let revision = 0;
  let source = 'MISS';
  let fallback: Snapshot | undefined;
  let warned = false;
  const pointer = async () =>
    (await cacheIO(() => cache.get(POINTER))) as Pointer | null;
  async function cached(meta: Pointer | null): Promise<Snapshot | undefined> {
    if (!meta || meta.expiresAt <= now()) return;
    if (memory?.generation === meta.generation) return memory;
    const parts = await Promise.all(
      Array.from({ length: meta.parts }, (_, index) =>
        cacheIO(() =>
          cache.get(`publication-data:${meta.generation}:${index}`),
        ),
      ),
    );
    if (parts.some((part) => typeof part !== 'string')) return;
    const payload = parts.join('');
    const articles = JSON.parse(
      gunzipSync(Buffer.from(payload, 'base64')).toString('utf8'),
    ) as Article[];
    return (memory = { ...meta, articles });
  }
  async function write(articles: Article[]) {
    const previous = (await cacheIO(() =>
      cache.get(LAST_GOOD),
    )) as Pointer | null;
    const payload = gzipSync(JSON.stringify(articles)).toString('base64');
    // Each part remains comfortably below Vercel's 2 MB item limit as the archive grows.
    const parts = payload.match(/.{1,1000000}/g) || [''];
    const meta = {
      generation: randomUUID(),
      expiresAt: now() + PUBLICATION_TTL * 1000,
      parts: parts.length,
    };
    // Write immutable data before switching the pointer. Readers never see a partial set.
    await Promise.all(
      parts.map((part, index) =>
        cacheIO(() =>
          cache.set(`publication-data:${meta.generation}:${index}`, part, {
            ttl: RETENTION,
            name: 'Sparks published content (compressed)',
          }),
        ),
      ),
    );
    await cacheIO(() =>
      cache.set(POINTER, meta, {
        ttl: PUBLICATION_TTL,
        name: 'Sparks publication version',
      }),
    );
    await cacheIO(() =>
      cache.set(
        LAST_GOOD,
        { ...meta, expiresAt: now() + RETENTION * 1000 },
        { ttl: RETENTION, name: 'Sparks last published dataset' },
      ),
    );
    // Retain one dataset, rather than accumulating large historical cache entries.
    if (previous && previous.generation !== meta.generation)
      await Promise.all(
        Array.from({ length: previous.parts }, (_, index) =>
          cache
            .delete(`publication-data:${previous.generation}:${index}`)
            .catch(() => {}),
        ),
      );
    return (memory = { ...meta, articles });
  }
  async function hydrate() {
    const started = revision;
    const before = await pointer();
    const articles = await read();
    if (started !== revision) return load();
    // A publisher or another cold function may have refreshed while SQL was running.
    const after = await pointer();
    if (after?.generation !== before?.generation) {
      const newer = await cached(after);
      if (newer) return newer;
    }
    console.info('Publication cache database refresh');
    return write(articles);
  }
  async function load(): Promise<Snapshot> {
    if (!pending) {
      // Share cache fetch/decompression too, not just the database miss path.
      const task = (async () => {
        const hit = await cached(await pointer());
        if (hit) {
          source = 'HIT';
          return hit;
        }
        source = 'MISS';
        return hydrate();
      })().catch(async (error) => {
        if (!(error instanceof CacheStorageError)) {
          // An exhausted/suspended database must not take the already published site down.
          const backup = (await cacheIO(() =>
            cache.get(LAST_GOOD),
          )) as Pointer | null;
          const lastGood = await cached(backup);
          if (!lastGood) throw error;
          source = 'STALE';
          const retry = { ...backup!, expiresAt: now() + 3600000 };
          await cacheIO(() =>
            cache.set(POINTER, retry, {
              ttl: 3600,
              name: 'Sparks database retry backoff',
            }),
          );
          console.warn(
            'Database unavailable; serving the last published dataset.',
          );
          return (memory = { ...lastGood, ...retry });
        }
        source = 'BYPASS';
        if (!warned) {
          console.warn(
            'Publication cache unavailable; using bounded database fallback.',
          );
          warned = true;
        }
        if (fallback && fallback.expiresAt > now()) return fallback;
        fallback = {
          generation: randomUUID(),
          expiresAt: now() + 30000,
          parts: 0,
          articles: await read(),
        };
        return (memory = fallback);
      });
      pending = task;
      void task
        .finally(() => {
          if (pending === task) pending = undefined;
        })
        .catch(() => {});
    }
    return pending;
  }
  return {
    load,
    async refresh() {
      revision++;
      fallback = undefined;
      pending = undefined;
      const snapshot = await write(await read());
      await purge();
      return snapshot;
    },
    diagnostics: () => ({ source, generation: memory?.generation }),
    sharedMaxAge() {
      const next = memory?.articles
        .map((article) => Date.parse(article.publishedAt))
        .filter((date) => date > now())
        .sort((a, b) => a - b)[0];
      return Math.max(
        1,
        Math.min(
          PUBLIC_HTML_TTL,
          next ? Math.floor((next - now()) / 1000) : PUBLIC_HTML_TTL,
        ),
      );
    },
  };
}
