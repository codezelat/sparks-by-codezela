import { writeFile } from 'node:fs/promises';
const origin = 'https://sparks.codezela.com';
const paths = [
  '/',
  '/about/',
  '/page/1/',
  '/page/32/',
  '/author/codezela-cc/',
  '/author/codezela-cc/page/32/',
  '/tag/news/',
  '/rss/',
  '/sitemap.xml',
  '/robots.txt',
  '/search/?q=google',
  '/private-live-verification/',
  '/api/studio/articles/',
  '/api/studio/history/',
  '/studio/',
  '/sparks-missing-verification/',
];
const rows = await Promise.all(
  paths.map(async (path) => {
    const r = await fetch(origin + path, { redirect: 'manual' });
    return {
      path,
      status: r.status,
      cache: r.headers.get('cache-control'),
      robots: r.headers.get('x-robots-tag'),
      location: r.headers.get('location'),
      contentType: r.headers.get('content-type'),
    };
  }),
);
const expected = [
  200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 404, 401, 401, 303,
  404,
];
const errors: unknown[] = rows.filter((r, i) => r.status !== expected[i]);
for (const row of rows) {
  if (
    row.path.startsWith('/author/') &&
    (row.robots?.includes('noindex') || !row.cache?.includes('public'))
  )
    errors.push({
      path: row.path,
      error: 'Public author archive must be indexable and cacheable',
    });
  if (
    (row.path.startsWith('/api/studio/') || row.path === '/studio/') &&
    (!row.robots?.includes('noindex') || !row.cache?.includes('no-store'))
  )
    errors.push({
      path: row.path,
      error: 'Private responses must be noindex and no-store',
    });
}
const preview = await fetch('https://sparks-by-codezela.vercel.app/');
const slashless = await fetch(origin + '/who-are-google-ads-search-partners', {
  redirect: 'manual',
});
const report = {
  verifiedAt: new Date().toISOString(),
  rows,
  previewNoindex: preview.headers.get('x-robots-tag'),
  slashlessRedirect: {
    status: slashless.status,
    location: slashless.headers.get('location'),
  },
  errors,
};
await writeFile(
  'docs/verification/http-live.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (errors.length || !report.previewNoindex?.includes('noindex'))
  process.exit(1);
