import type { APIRoute } from 'astro';
import {
  appOrigin,
  authConfigured,
  cookieOptions,
  env,
  randomState,
  signToken,
} from '../../lib/auth';
export const GET: APIRoute = ({ cookies, redirect }) => {
  if (!authConfigured())
    return redirect('/studio/login/?error=configuration', 303);
  const state = randomState();
  cookies.set(
    'sparks_oauth',
    signToken({ id: state, name: 'oauth-state', expires: Date.now() + 600000 }),
    { ...cookieOptions(), maxAge: 600 },
  );
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env('GITHUB_CLIENT_ID'));
  url.searchParams.set('redirect_uri', `${appOrigin()}/auth/callback/`);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  return redirect(url.toString(), 302);
};
