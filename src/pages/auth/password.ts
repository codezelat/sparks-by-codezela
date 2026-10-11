import type { APIRoute } from 'astro';
import { database } from '../../lib/db';
import {
  validOrigin,
  cookieName,
  cookieOptions,
  env,
  signToken,
} from '../../lib/auth';
import { limitKey, verifyPassword } from '../../lib/password';
export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
  clientAddress,
}) => {
  if (!validOrigin(request)) return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('content-length')) > 4000)
    return new Response('Request too large', { status: 413 });
  try {
    const query = await database();
    const key = limitKey(clientAddress || 'unknown');
    const limit = await query<{ attempts: number }>(
      `INSERT INTO signin_limits(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN signin_limits.window_started < now()-interval '15 minutes' THEN 1 ELSE signin_limits.attempts+1 END,window_started=CASE WHEN signin_limits.window_started < now()-interval '15 minutes' THEN now() ELSE signin_limits.window_started END RETURNING attempts`,
      [key],
    );
    if (limit[0].attempts > 10)
      return new Response(
        'Too many sign-in attempts. Try again in 15 minutes.',
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    const form = await request.formData();
    const email = String(form.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') || '');
    const users = await query<{ email: string; password_hash: string }>(
      'SELECT email,password_hash FROM admin_users WHERE email=$1 AND active=true',
      [email],
    );
    const hash =
      users[0]?.password_hash ||
      `scrypt$00000000000000000000000000000000$${'0'.repeat(128)}`;
    const valid = await verifyPassword(password, hash);
    if (
      !valid ||
      !users[0] ||
      email !== env('ADMIN_EMAIL').trim().toLowerCase()
    )
      return redirect('/studio/login/?error=credentials', 303);
    await query('DELETE FROM signin_limits WHERE key=$1', [key]);
    cookies.set(
      cookieName(),
      signToken({
        id: `email:${email}`,
        name: email,
        expires: Date.now() + 8 * 3600000,
      }),
      { ...cookieOptions(), maxAge: 8 * 3600 },
    );
    return redirect('/studio/', 303);
  } catch {
    return redirect('/studio/login/?error=sign-in', 303);
  }
};
