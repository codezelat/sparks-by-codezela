import snapshot from '../src/data/ghost-snapshot.json';
import inventory from '../docs/migration-inventory.json';
import { neon } from '@neondatabase/serverless';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
const errors: string[] = [];
const source = 'https://sparks.codezela.com';
const base = process.argv[2]?.replace(/\/$/, '');
const originals = [...snapshot.posts, ...snapshot.pages];
const homepage = await fetch('https://sparks-by-codezela.ghost.io').then((r) =>
  r.text(),
);
const key =
  process.env.GHOST_CONTENT_KEY ||
  homepage.match(/data-key="([a-f0-9]+)"/)?.[1];
if (!key) throw new Error('Public Ghost API key is unavailable.');
const remote: any[] = [];
for (const type of ['posts', 'pages']) {
  let page: number | null = 1;
  while (page) {
    const response: Response = await fetch(
      `https://sparks-by-codezela.ghost.io/ghost/api/content/${type}/?key=${key}&limit=100&page=${page}&include=tags,authors&formats=html,plaintext`,
    );
    if (!response.ok) throw new Error(`Source ${type}: ${response.status}`);
    const data: any = await response.json();
    remote.push(...data[type]);
    page = data.meta.pagination.next;
  }
}
const fields: Record<string, string> = {
  title: 'title',
  slug: 'slug',
  html: 'html',
  plaintext: 'plaintext',
  featureImageCaption: 'feature_image_caption',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  canonicalUrl: 'canonical_url',
  ogTitle: 'og_title',
  ogDescription: 'og_description',
  twitterTitle: 'twitter_title',
  twitterDescription: 'twitter_description',
};
for (const p of originals) {
  const live = remote.find((q) => q.id === p.id);
  if (!live) {
    errors.push(`Missing from source: ${p.slug}`);
    continue;
  }
  for (const [local, ghost] of Object.entries(fields)) {
    if ((p as any)[local] !== (live[ghost] || ''))
      errors.push(`Source mismatch ${p.slug}:${local}`);
  }
  if (
    p.publishedAt !== new Date(live.published_at).toISOString() ||
    p.updatedAt !== new Date(live.updated_at).toISOString()
  )
    errors.push(`Date mismatch ${p.slug}`);
  if (p.excerpt !== (live.custom_excerpt || live.excerpt || ''))
    errors.push(`Excerpt mismatch ${p.slug}`);
  for (const attr of ['authors', 'tags'])
    if (
      !isDeepStrictEqual(
        (p as any)[attr],
        live[attr].map((a: any) => a.slug),
      )
    )
      errors.push(`Taxonomy mismatch ${p.slug}:${attr}`);
}
for (const p of remote)
  if (!originals.some((q) => q.id === p.id))
    errors.push(`New source content requires import: ${p.slug}`);
let databaseCount: number | undefined;
if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  const rows =
    await sql`SELECT published FROM articles WHERE published IS NOT NULL`;
  databaseCount = rows.length;
  for (const p of originals) {
    const value = rows.find((r) => r.published?.id === p.id)?.published;
    if (!value) {
      errors.push(`Database missing ${p.slug}`);
      continue;
    }
    for (const [key, valueBefore] of Object.entries(p))
      if (!isDeepStrictEqual(value[key], valueBefore))
        errors.push(`Database mismatch ${p.slug}:${key}`);
  }
}
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
let checked = 0;
const media = new Set<string>();
if (base) {
  const queue = [...originals];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const p = queue.shift()!;
        try {
          const response = await fetch(`${base}/${p.slug}/`, {
            signal: AbortSignal.timeout(30000),
          });
          if (response.status !== 200) {
            errors.push(`HTTP ${response.status}: ${p.slug}`);
            continue;
          }
          const $ = cheerio.load(await response.text());
          if ($('h1').length !== 1 || $('h1').text() !== p.title)
            errors.push(`Heading ${p.slug}`);
          if (
            normalize($('.prose').text()) !==
            normalize(cheerio.load(p.html).text())
          )
            errors.push(`Body ${p.slug}`);
          if ($('title').text() !== (p.metaTitle || p.title))
            errors.push(`Title ${p.slug}`);
          if (
            $('meta[name=description]').attr('content') !==
            (p.metaDescription || p.excerpt)
          )
            errors.push(`Description ${p.slug}`);
          if (
            $('link[rel=canonical]').attr('href') !==
            (p.canonicalUrl || `${source}/${p.slug}/`)
          )
            errors.push(`Canonical ${p.slug}`);
          if (!$('script[type="application/ld+json"]').length)
            errors.push(`Schema ${p.slug}`);
          if (p.featureImage && !$(`img[src="${p.featureImage}"]`).length)
            errors.push(`Cover ${p.slug}`);
          $('img[src]').each((_, el) => {
            const src = $(el).attr('src')!;
            media.add(new URL(src, base).href);
          });
          checked++;
        } catch (error) {
          errors.push(`Fetch ${p.slug}:${(error as Error).message}`);
        }
      }
    }),
  );
  const mediaQueue = [...media];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (mediaQueue.length) {
        const url = mediaQueue.shift()!;
        const r = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) errors.push(`Media HTTP ${r.status}:${url}`);
      }
    }),
  );
  const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
  for (const url of inventory.sourceSitemapUrls)
    if (!sitemap.includes(url.replace(/&/g, '&amp;')))
      errors.push(`Sitemap missing ${url}`);
}
const report = {
  verifiedAt: new Date().toISOString(),
  source,
  base,
  sourcePosts: snapshot.posts.length,
  sourcePages: snapshot.pages.length,
  liveSourceCount: remote.length,
  databaseCount,
  originalSitemapPosts: inventory.sourceSitemapPosts,
  verifiedPages: checked,
  verifiedMedia: media.size,
  errors,
};
await mkdir('docs/verification', { recursive: true });
await writeFile(
  `docs/verification/migration-${base ? 'hosted' : 'source'}.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
