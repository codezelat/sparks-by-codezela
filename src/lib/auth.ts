import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { localStudio } from './db';
export function env(name: string) {
  return import.meta.env[name] || process.env[name] || '';
}
export function appOrigin() {
  return env('APP_ORIGIN') || 'https://sparks.codezela.com';
}
export function authConfigured() {
  return Boolean(
    env('GITHUB_CLIENT_ID') &&
    env('GITHUB_CLIENT_SECRET') &&
    env('SESSION_SECRET').length >= 32 &&
    env('GITHUB_ADMIN_IDS'),
  );
}
export function passwordConfigured() {
  return Boolean(env('ADMIN_EMAIL') && env('SESSION_SECRET').length >= 32);
}
export type Session = { id: string; name: string; expires: number };
export function signToken(value: Session, secret = env('SESSION_SECRET')) {
  if (secret.length < 32)
    throw new Error('Session signing key is not configured');
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyToken(
  token: string,
  secret = env('SESSION_SECRET'),
): Session | null {
  if (secret.length < 32 || token.length > 4096) return null;
  try {
    const [payload, signature, ...extra] = token.split('.');
    if (extra.length || !signature) return null;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (
      typeof session.id !== 'string' ||
      typeof session.name !== 'string' ||
      typeof session.expires !== 'number' ||
      session.expires <= Date.now()
    )
      return null;
    return session;
  } catch {
    return null;
  }
}
export function cookieName() {
  return appOrigin().startsWith('https:')
    ? '__Host-sparks_session'
    : 'sparks_session';
}
export function cookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: appOrigin().startsWith('https:'),
    sameSite: 'lax' as const,
  };
}
export function allowedAdmin(id: string) {
  return env('GITHUB_ADMIN_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(id);
}
export function getSession(cookies: AstroCookies, url: URL): Session | null {
  if (
    localStudio() &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    return {
      id: 'local-developer',
      name: 'Local development',
      expires: Date.now() + 3600000,
    };
  const session = verifyToken(cookies.get(cookieName())?.value || '');
  return session &&
    (allowedAdmin(session.id) ||
      (passwordConfigured() &&
        session.id === `email:${env('ADMIN_EMAIL').trim().toLowerCase()}`))
    ? session
    : null;
}
export function randomState() {
  return randomBytes(32).toString('base64url');
}
export function validOrigin(request: Request) {
  const origin = new URL(request.url).origin;
  return (
    [appOrigin(), 'https://sparks.codezela.com'].includes(origin) &&
    request.headers.get('origin') === origin
  );
}
export function validMutation(request: Request) {
  return (
    validOrigin(request) &&
    ['application/json', 'multipart/form-data'].some((type) =>
      request.headers.get('content-type')?.startsWith(type),
    )
  );
}
