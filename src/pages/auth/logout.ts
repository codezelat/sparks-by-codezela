import type { APIRoute } from 'astro';
import { validOrigin, cookieName } from '../../lib/auth';
export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (!validOrigin(request)) return new Response('Forbidden', { status: 403 });
  cookies.delete(cookieName(), { path: '/' });
  return redirect('/', 303);
};
