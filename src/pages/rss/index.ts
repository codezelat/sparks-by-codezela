import type { APIRoute } from 'astro';
import { listArticles, site, origin } from '../../lib/site';
import { xmlEscape } from '../../lib/content';
export const GET: APIRoute = async () => {
  const { articles } = await listArticles({ limit: 50 });
  const items = articles
    .map(
      (p) =>
        `<item><title>${xmlEscape(p.title)}</title><link>${origin}/${p.slug}/</link><guid isPermaLink="true">${origin}/${p.slug}/</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${xmlEscape(p.excerpt)}</description></item>`,
    )
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(site.name)}</title><link>${origin}/</link><description>${xmlEscape(site.description)}</description><language>en</language>${items}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
