import type { APIRoute } from 'astro';
import { database } from '../../../lib/db';
import { repository, ConflictError } from '../../../lib/repository';
import { articleInput, prepareArticle } from '../../../lib/content';
import { validMutation } from '../../../lib/auth';
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Math.max(
      1,
      Math.min(10000, Number(url.searchParams.get('page')) || 1),
    );
    return json(
      await repository(await database()).studioList(
        page,
        url.searchParams.get('q')?.slice(0, 200) || '',
        url.searchParams.get('status') || '',
        url.searchParams.get('kind') === 'page' ? 'page' : 'post',
      ),
    );
  } catch {
    return json(
      { error: 'Content database is unavailable. Please try again.' },
      503,
    );
  }
};
export const POST: APIRoute = async ({ request, locals }) => {
  if (!validMutation(request))
    return json({ error: 'Invalid request origin' }, 403);
  if (Number(request.headers.get('content-length')) > 600000)
    return json({ error: 'Article is too large' }, 413);
  try {
    const body = await request.json();
    const input = articleInput.safeParse(body.article);
    if (!input.success)
      return json(
        {
          error: input.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        },
        400,
      );
    if (
      !['draft', 'publish'].includes(body.action) ||
      !Number.isInteger(body.version) ||
      body.version < 0 ||
      !/^[-a-zA-Z0-9]{1,80}$/.test(body.id || '')
    )
      return json({ error: 'Invalid save request' }, 400);
    const article = prepareArticle(input.data, body.id);
    const existing = await repository(await database()).studioGet(body.id);
    const previous = existing?.draft || existing?.published;
    if (previous?.featureImage === article.featureImage)
      article.image = previous.image;
    if (body.action === 'publish' && !article.plaintext)
      return json({ error: 'Add article content before publishing' }, 400);
    const result = await repository(await database()).save(
      article,
      body.version,
      body.action,
      locals.session!.id,
    );
    return json({ ...result, article, url: `/${article.slug}/` });
  } catch (error) {
    if (error instanceof ConflictError)
      return json({ error: error.message }, 409);
    if ((error as { code?: string }).code === '23505')
      return json(
        { error: 'This URL is already used by another article' },
        409,
      );
    return json(
      { error: 'The article could not be saved. Please try again.' },
      503,
    );
  }
};
