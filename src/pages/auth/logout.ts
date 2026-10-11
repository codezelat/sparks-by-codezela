import type { APIRoute } from 'astro';
import { appOrigin, cookieName } from '../../lib/auth';
export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (request.headers.get('origin') !== appOrigin())
    return new Response('Forbidden', { status: 403 });
  cookies.delete(cookieName(), { path: '/' });
  return redirect('/', 303);
};
