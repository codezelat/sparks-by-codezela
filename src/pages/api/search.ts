import type { APIRoute } from 'astro';
import { listArticles } from '../../lib/site';
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim().slice(0, 200) || '';
  if (!q) return Response.json({ articles: [], total: 0 });
  try {
    const { articles, total } = await listArticles({ search: q, limit: 10 });
    return Response.json({
      articles: articles.map(({ slug, title, publishedAt }) => ({
        slug,
        title,
        publishedAt,
      })),
      total,
    });
  } catch {
    return Response.json({ error: 'Search unavailable' }, { status: 503 });
  }
};
