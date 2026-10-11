import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../src/lib/password';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL and ADMIN_EMAIL first.');
const sql = neon(process.env.DATABASE_URL);
const password = randomBytes(24).toString('base64url');
const hash = await hashPassword(password);
const rows =
  await sql`UPDATE admin_users SET password_hash=${hash},active=true WHERE email=${email} RETURNING id`;
if (!rows.length)
  throw new Error('Create the administrator first with bun run admin:create.');
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/studio-access.txt',
  `Sparks Studio\nEmail: ${email}\nPassword: ${password}\n\nKeep this file private. It is ignored by Git.\n`,
  { mode: 0o600 },
);
console.log(
  'New credential saved privately to .local/studio-access.txt. Existing sessions expire within 8 hours. Rotate SESSION_SECRET to end all sessions immediately.',
);
