import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
export default defineConfig({
  site: 'https://sparks.codezela.com',
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  vite: {
    cacheDir:
      process.env.SPARKS_DEV === '1'
        ? 'node_modules/.vite-sparks-dev'
        : 'node_modules/.vite-sparks-build',
    server: { allowedHosts: ['localhost', '127.0.0.1'] },
  },
});
