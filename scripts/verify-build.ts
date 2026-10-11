import { readFile, readdir } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
const root = '.vercel/output/functions/_render.func/dist/server';
const entry = await readFile(`${root}/entry.mjs`, 'utf8');
if (/import\s*["']rolldown["']/.test(entry))
  throw new Error(
    'Build-only Rolldown dependency leaked into the production server.',
  );
for (const name of await readdir(`${root}/chunks`)) {
  if (!name.endsWith('.mjs')) continue;
  const body = await readFile(`${root}/chunks/${name}`, 'utf8');
  for (const match of body.matchAll(/__require\(["']([^"']+)["']\)/g)) {
    if (!isBuiltin(match[1]))
      throw new Error(`Untraced server dependency: ${match[1]} in ${name}`);
  }
}
console.log(
  'Server bundle verification passed. No build-only native imports or untraced CommonJS dependencies.',
);
