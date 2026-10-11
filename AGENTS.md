# Working on Sparks

## Scope and source of truth

This repository replaces the public Sparks publication with an Astro site and Neon-backed Studio. Treat published text, original slugs, dates, author identity, SEO overrides and approved brand wording as user-owned content. Preserve them unless the user explicitly requests a change. Do not invent claims, dates, counts or placeholder articles.

`docs/migration-inventory.json` records the original 374 articles, one About page, original sitemap and approved missing-image replacement. `src/data/ghost-snapshot.json` is migration evidence and bootstrap data. Neon is the production editorial source of truth. Never overwrite a Studio edit with a refreshed Ghost import.

The public site must remain independent of Ghost. Do not add runtime Content API requests, Ghost assets, authentication, embeds, navigation or publishing dependencies. One-time source import/verification scripts may retain the original source address while the migration is being checked.

## Tooling and repository hygiene

- Use Bun for installs, scripts, tests, audits, formatting and builds. Retain `bun.lock`; never introduce another package manager's lockfile.
- The user explicitly requested no GitHub Actions. Do not create `.github/workflows` or other Actions automation.
- Use the existing Astro, React, Tiptap, Neon and Vercel architecture. Add dependencies only for a concrete need.
- Keep secrets in ignored local environment files or Vercel environment settings. Never log connection strings, signing keys, Blob tokens, password hashes or passwords.
- Preserve `.env.example` and SQL migrations in Git even when global ignore rules match them. Inspect `git check-ignore` when required source files disappear from status.
- Keep source readable with Prettier. Exclude large imported JSON and media from formatting.
- Do not retain temporary test content, test media, error dumps, build output, caches or unrelated files as source.
- Stop only servers, browser tabs and background processes created for your task. Preserve pre-existing user activity. Verify cleanup before handoff.

## Public UI and editorial style

Maintain a white background, restrained typography, gray rules, ample reading space and the small violet accent. Use the existing self-hosted Inter font and shared components. Avoid redundant copy, decorative gradients, heavy shadows, promotional placeholders and unnecessary client frameworks.

Public reading, archive links, pagination and SEO must work without JavaScript. Keep React and the rich editor limited to Studio. Use semantic headings, alt text, labeled controls, visible focus states, native modal dialogs and reduced-motion support.

Article covers preserve their full aspect ratio. Compact archive thumbnails may crop intentionally. Test very tall images, wide images, long titles, long paragraphs, lists, quotes, links, tables and narrow screens. New user-facing wording must not contain en or em dashes. Existing original content is preserved exactly.

## Data and publishing invariants

- Production requires `DATABASE_URL` and must never enable the development bypass or embedded Postgres fallback.
- Use parameterized queries. Protect content with the shared Zod schema and server-side HTML sanitization.
- Public queries return only published entries whose publication date has arrived. Drafts and private revisions must never appear in public search, RSS, sitemap or archives.
- Public lists return summaries without bodies. Keep the date, full-text and taxonomy indexes aligned with query changes.
- Preserve the optimistic version check and atomic revision write. A stale editor cannot overwrite newer work.
- Published URLs remain protected. Do not silently rename migrated articles or remove the original canonical override.
- Save draft leaves the current published article untouched. Revision restoration also creates a private draft.
- Pages and posts share editing but remain separate in article archives and RSS. New public pages must enter the sitemap.
- Apply new schema changes through a new numbered SQL migration. Never edit an already applied migration or its recorded checksum.
- Seed is insert-only. Do not invoke migration, seed or destructive cleanup on server requests or normal builds.
- Test and clean up only specifically identified task-created records. Never delete or modify original articles for QA.

## Security, media and caching

Require the shared administrator session for every Studio page and API. Check the request origin for every mutation, including login and logout. Keep session cookies secure, HttpOnly, signed and time-limited. Preserve the sign-in rate limit and private `no-store`/`noindex` headers.

Resize and validate uploads independently on the server even when the client already prepares them. Keep the request within Vercel's body limits, validate actual image decoding, restrict formats/pixels, and preserve dimensions and responsive variants in article metadata. Vercel Blob is public media storage, not secret-file storage.

Canonical, sitemap, RSS and schema URLs use `https://sparks.codezela.com`. The custom domain is indexable; alternate deployment hosts must remain noindex. Private content, errors and search must remain excluded. Public HTML has a 30-second CDN lifetime; account for it when verifying publishing and scheduling. Do not cache personal Studio responses.

Astro 7/Vercel currently pulls an unused Rolldown import into the server bundle through adapter exports. The narrow `moduleSideEffects` build rule removes that build-only import. The server bundle also includes the sanitizer dependency tree explicitly because Vercel does not trace generated CommonJS calls correctly. The build guard rejects untraced package requires. Preserve these rules until updated adapters and dependencies are verified live. Never fix this by silently downgrading, shipping the local native binary, or ignoring a live startup failure.

## Verification and delivery

Run `bun run format:check`, `bun run check`, `bun test`, `bun audit` and `bun run build` after relevant changes. Use the real SQL tests for publishing changes. Add meaningful contracts for new behavior, not tests that merely mirror implementation.

Use the existing migration verification tool while the original source remains available. After Ghost is removed, preserve committed migration evidence and verify the current database and public routes against the accepted publication. Never make runtime availability depend on a legacy-source check.

Inspect the rendered desktop and mobile site and exercise Studio saves, previews, uploads, metadata, scheduling and publication when those paths change. Save intentional release screenshots separately from disposable debugging artifacts. Verify browser errors and actual HTTP responses.

A local build, a Vercel deployment marked Ready, direct-origin success and the public domain are different evidence. Check the actual live domain and authenticated workflow before reporting a release as ready. Report any unresolved failure accurately. No score or generic "100 percent" claim substitutes for evidence.

Document actual behavior, environment settings, commands and limitations in README. Keep release evidence in `docs/verification`, with the deployment identity and date. Do not commit private credential files or environment exports. Do not change DNS, delete Ghost, send email, add paid services or touch unrelated Vercel projects without user authorization.
