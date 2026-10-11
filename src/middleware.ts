import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const privatePath =
    path.startsWith('/studio') ||
    path.startsWith('/api/studio') ||
    path.startsWith('/auth');
  context.locals.session = getSession(context.cookies, context.url);
  if (path.startsWith('/api/studio') && !context.locals.session)
    return new Response(JSON.stringify({ error: 'Sign in to continue' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  if (
    path.startsWith('/studio') &&
    path !== '/studio/login/' &&
    !context.locals.session
  )
    return context.redirect('/studio/login/', 303);
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  );
  const preview = ![
    'sparks.codezela.com',
    'localhost',
    '127.0.0.1',
    '[::1]',
  ].includes(context.url.hostname);
  if (preview) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (privatePath || response.status >= 400) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  } else if (context.request.method === 'GET') {
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=30');
  }
  return response;
});
