import { it, expect } from 'bun:test';
import { hashPassword, verifyPassword } from '../src/lib/password';
it('accepts the correct password and rejects invalid, malformed and oversized credentials', async () => {
  const hash = await hashPassword('A valid private password');
  expect(await verifyPassword('A valid private password', hash)).toBe(true);
  expect(await verifyPassword('Wrong password', hash)).toBe(false);
  expect(await verifyPassword('x', 'broken')).toBe(false);
  expect(await verifyPassword('x'.repeat(257), hash)).toBe(false);
}, 10000);
