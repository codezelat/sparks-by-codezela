import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../src/lib/password';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL and ADMIN_EMAIL first.');
const sql = neon(process.env.DATABASE_URL);
const existing = await sql`SELECT id FROM admin_users WHERE email=${email}`;
if (existing.length) {
  console.log('This administrator already exists. No credential was changed.');
  process.exit(0);
}
const password = randomBytes(24).toString('base64url');
const hash = await hashPassword(password);
await sql`INSERT INTO admin_users(id,email,password_hash) VALUES(${randomUUID()},${email},${hash})`;
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/studio-access.txt',
  `Sparks Studio\nEmail: ${email}\nPassword: ${password}\n\nKeep this file private. It is ignored by Git.\n`,
  { mode: 0o600 },
);
console.log(
  'Administrator created. Credentials saved privately to .local/studio-access.txt.',
);
