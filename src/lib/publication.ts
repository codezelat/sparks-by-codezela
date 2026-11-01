import { getCache, dangerouslyDeleteByTag } from '@vercel/functions';
import { createPublicationCache, PUBLICATION_TAG } from './publication-cache';
import { database } from './db';
import type { Article } from './content';

export const publicationCache = createPublicationCache({
  cache: getCache({ namespace: 'sparks-by-codezela-publication-v2' }),
  read: async () => {
    const query = await database();
    const rows = await query<{ data: Article }>(
      'SELECT published AS data FROM articles WHERE published IS NOT NULL ORDER BY published_at DESC,id',
    );
    return rows.map((row) => row.data);
  },
  // A hard purge is intentional: unpublished content must not be served stale.
  purge: () => dangerouslyDeleteByTag(PUBLICATION_TAG),
});

export const publicCacheEnabled = () =>
  import.meta.env.PROD && process.env.VERCEL === '1';

export async function refreshPublication() {
  if (!publicCacheEnabled()) return;
  try {
    await publicationCache.refresh();
  } catch {
    console.error('Public content refresh failed after the database save.');
    // Expire the pointer so the next public request retries from the current database.
    const cache = getCache({ namespace: 'sparks-by-codezela-publication-v2' });
    await cache.delete('publication-v1').catch(() => {});
    await cache.delete('publication-last-good-v1').catch(() => {});
    await dangerouslyDeleteByTag(PUBLICATION_TAG).catch(() => {});
    return 'Saved, but the public site could not refresh. Please publish again to retry.';
  }
}
