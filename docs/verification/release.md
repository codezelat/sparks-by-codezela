# Live release evidence

Verified 11 October 2026. The public domain is serving the replacement Astro publication over HTTPS through public DNS.

- Production deployment: `dpl_5KrkaEtoRCuDwz1tp7jeGhAb3igF`, Ready.
- Public site: <https://sparks.codezela.com/>
- Studio: <https://sparks.codezela.com/studio/>
- Vercel project: `sparks-by-codezela`, scope `sayuruakashs-projects`, requested account `sayuru555@gmail.com`.
- Production environment has the direct Neon connection, session secret, `ADMIN_EMAIL=info@codezela.com`, application origin and Blob token. No Neon marketplace integration is used.

## Failures corrected

The Node server initially imported a build-only Rolldown native module and failed to start. The build now removes that unused adapter import. The sanitizer's CommonJS/ESM dependencies also needed explicit server bundling because Vercel did not trace generated CommonJS calls. `scripts/verify-build.ts` checks both failure patterns on every build.

The route-prefix check incorrectly treated `/author/` as `/auth/`, making author archives private and noindex. It now matches route boundaries. Authentication redirects also receive the same private headers as other Studio responses. `scripts/verify-live.ts` verifies this behavior on the public domain.

## Passed checks

- `bun run check`: zero errors, warnings or hints.
- `bun test`: 16 passed, 44 assertions, including real Postgres publishing contracts.
- `bun run format:check`, `bun audit`, `git diff --check` and production build passed.
- `migration-hosted.json`: all 375 original content routes and 372 distinct covers verified; original text and SEO metadata matched, original sitemap URLs present, zero errors.
- `studio-live.json`: actual administrator browser sign-in, draft save, responsive Blob upload, future publication, revision history, unpublish and private preview verified. Temporary article and uploaded images removed. All 375 original Neon entries exactly match the accepted snapshot.
- `http-live.json`: homepage, About, archive pagination, author/tag routes, search, RSS, sitemap and robots return expected responses. Private APIs require authentication; private redirects are no-store/noindex. Alternate Vercel host is noindex. Slashless article URLs redirect permanently.
- Desktop and mobile rendered in Browser/IAB. At 390 pixels there is no horizontal document overflow, all homepage images loaded and the browser reported no errors. Screenshots and the design comparison are retained as intentional release evidence.
- No GitHub Actions. No Ghost runtime or media hosting dependencies. Original source import and optional verification scripts are offline migration tools.

This verifies the migrated public publication and editorial workflow. It does not claim a numerical Lighthouse score or implement Ghost memberships, paid subscriptions or newsletters. See README for operating, backup and update instructions.
