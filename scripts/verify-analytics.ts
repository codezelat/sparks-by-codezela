import { load } from 'cheerio';
import { writeFile } from 'node:fs/promises';

const id = 'G-1FHLXFGZRV';
const origin = 'https://sparks.codezela.com';
const cases = [
  { url: `${origin}/`, enabled: true },
  { url: `${origin}/about/`, enabled: true },
  { url: `${origin}/who-are-google-ads-search-partners/`, enabled: true },
  { url: `${origin}/author/codezela-cc/`, enabled: true },
  { url: `${origin}/studio/login/`, enabled: false },
  { url: `${origin}/search/`, enabled: false },
  { url: `${origin}/sparks-missing-verification/`, enabled: false },
  { url: 'https://sparks-by-codezela.vercel.app/', enabled: false },
];
const rows = await Promise.all(
  cases.map(async ({ url, enabled }) => {
    const response = await fetch(url);
    const $ = load(await response.text());
    const loaders = $('script[src*="googletagmanager.com/gtag/js"]');
    const configurations = $('script')
      .toArray()
      .filter((el) => /gtag\(['"]config['"]/.test($(el).text()));
    const passed = enabled
      ? response.ok &&
        loaders.length === 1 &&
        loaders.attr('src') ===
          `https://www.googletagmanager.com/gtag/js?id=${id}` &&
        loaders.attr('async') !== undefined &&
        configurations.length === 1 &&
        $(configurations[0]).text().includes(id)
      : loaders.length === 0 && configurations.length === 0;
    return {
      url,
      status: response.status,
      enabled,
      loaders: loaders.length,
      configurations: configurations.length,
      passed,
    };
  }),
);
const report = {
  verifiedAt: new Date().toISOString(),
  measurementId: id,
  rows,
};
await writeFile(
  'docs/verification/analytics-http.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (rows.some((row) => !row.passed)) process.exit(1);
