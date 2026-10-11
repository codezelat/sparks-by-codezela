# Sparks by Codezela

A minimal editorial website and publishing studio for [sparks.codezela.com](https://sparks.codezela.com/), built with Astro, React, Neon Postgres and Vercel.

![Sparks homepage](docs/verification/home-desktop.jpg)

The publication owns its content, URLs and media. Visitors receive server-rendered HTML. The rich editor loads only inside Studio. Publishing writes to Postgres, so articles go live without rebuilding or redeploying the website.

## What is included

- All 374 original articles and the About page, with their original slugs, wording, publication dates, authors, category, excerpts and SEO overrides.
- Home, article and page layouts, archive pagination, author and category archives, full-text search, RSS, sitemap, robots.txt and a real 404 response.
- A private browser editor at [/studio/](https://sparks.codezela.com/studio/), with drafts, previews, scheduling, metadata controls, cover and inline image uploads, version conflict protection, revision history and unpublishing.
- Self-hosted responsive WebP media and Inter fonts. Migrated images are served from this repository; new uploads use the project's Vercel Blob store.
- Password login for `info@codezela.com`, signed secure cookies, restricted mutation origins, HTML sanitization and sign-in rate limits.
- Manual quality checks using Bun. This project deliberately has no GitHub Actions.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Astro 7 | Server-rendered public pages, routes, SEO and private endpoints |
| React and Tiptap | Studio article list and visual editor |
| Neon Postgres | Published content, private drafts, revisions, search and administrator records |
| Vercel | Node server functions, CDN, HTTPS and production deployment |
| Vercel Blob | New cover and inline image uploads |
| Repository media | Permanent copies of migrated covers and site assets |

The public list queries omit article bodies, use indexed dates and taxonomy fields, and run independent count/data queries concurrently. Individual articles fetch their body and related summaries concurrently. Postgres's generated full-text index supports search.

Public HTML has a 30-second Vercel CDN lifetime. Studio, auth, private previews, write endpoints and errors use `no-store`. Publishing, updates, unpublishing and scheduled articles can therefore take up to 30 seconds to appear consistently in cached public views. Static build assets have immutable caching.

## Local setup

Use Bun 1.3.14 or newer and Node 24. The lockfile is committed. Do not create npm, pnpm or Yarn lockfiles.

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Set your own environment values in `.env`. Real credentials are ignored by Git and must never be copied into documentation.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection string |
| `APP_ORIGIN` | Exact Studio request origin, normally `https://sparks.codezela.com` |
| `SESSION_SECRET` | Random signing key of at least 32 characters |
| `ADMIN_EMAIL` | Allowed password administrator, `info@codezela.com` |
| `BLOB_READ_WRITE_TOKEN` | Project's public Vercel Blob store token |
| `PUBLIC_GA_ID` | Optional Google Analytics identifier; empty disables analytics |
| `LOCAL_STUDIO` | Development-only access bypass and embedded Postgres fallback |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_ADMIN_IDS` | Optional GitHub OAuth, not required for password login |

For development, set `APP_ORIGIN=http://localhost:4321`. With `LOCAL_STUDIO=true`, Studio is available only on loopback in development. If `DATABASE_URL` is set, local publishing changes that database. Use a separate Neon development branch when experimenting with real content. Without a URL, the development-only embedded Postgres store lives under `.local/postgres`.

```sh
bun run db:migrate
bun run db:seed
bun run admin:create
bun run dev
```

Open `http://localhost:4321`. Astro runs the development server in the background; stop it with `bunx astro dev stop`. Development and production builds use separate Vite caches.

Production requires Neon. It never enables the local Studio bypass or silently falls back to an embedded database. The imported snapshot remains available for deliberate offline development and migration evidence.

## Administrator access

Production Studio is at [sparks.codezela.com/studio/](https://sparks.codezela.com/studio/). The administrator email is `info@codezela.com`.

The generated password is saved locally in `.local/studio-access.txt`, with owner-only file permissions. It is excluded from Git and deployment uploads. The initial account is already created in the supplied Neon database. `admin:create` is idempotent and does not overwrite an existing password.

To generate a replacement credential:

```sh
bun run admin:password
```

This updates the configured account and replaces the private credential file. Existing signed sessions expire within eight hours. To immediately invalidate every session, replace `SESSION_SECRET` in Vercel and redeploy. There is no email delivery or external password-reset dependency.

## Writing and publishing

1. Sign in to Studio and select **New article**.
2. Enter the title. Studio proposes a URL from the title until you edit the URL yourself.
3. Write in the visual editor. Use headings, emphasis, lists, quotes, links, images, undo and redo.
4. Add an excerpt, cover, image description, category and publication date.
5. Open **Search and sharing** to override the SEO title, description, canonical URL, and social metadata when needed. Empty overrides use the article's title, excerpt and cover.
6. Select **Save draft**. A private preview becomes available after the first save.
7. Select **Publish**. A future publication date schedules visibility automatically; no cron job is needed.

Existing published articles keep their URL. **Save draft** keeps edits private while the current published version remains visible. **Update** publishes the edited version. The editor warns before closing a tab with unsaved edits and reports failed saves explicitly.

**History and publishing** shows the latest 50 revisions. Restoring a revision saves it as a draft; publishing that draft is a separate action. **Unpublish** preserves the content as a draft and removes it from public queries, search, RSS and the sitemap. Its public URL then returns 404 after the CDN cache expires. Concurrent saves from an older tab are rejected rather than overwriting newer work.

Select **Pages** to edit About or create another public page. Pages share the same draft and publishing workflow and are listed in the sitemap; article archives and RSS only contain articles.

The imported taxonomy contains the original News category and Codezela Content Creation author. Their public metadata lives in `src/data/site.json`. If adding taxonomy options, update the editor options and archive metadata together and deploy that source change.

## Images

Migrated assets have 480, 960 and 1600-pixel WebP versions in `public/media`. Their dimensions and responsive source sets are recorded in `src/data/media-manifest.json` and the imported content. The article view displays the full cover proportions, including tall and wide images. Archive thumbnails use deliberate preview crops.

New uploads accept JPEG, PNG, WebP and AVIF. The editor prepares images on the device before upload, accepting originals up to 30 MB and 40 megapixels. The server independently validates the image, rotates it, limits dimensions and creates 480, 960 and 1800-pixel WebP variants. The prepared request must fit under 4 MB. Images and their alt text are saved with the article. Use meaningful image descriptions for informative covers.

An HTTPS image URL is also supported. Uploading gives the publication an owned copy; an external URL remains dependent on that external provider. Never paste a Ghost-hosted image URL. Existing migration media has no Ghost hosting dependency.

## SEO and URL preservation

The imported article slugs are unchanged. The site uses trailing slashes and Vercel redirects slashless page requests with HTTP 308. Sitemap and RSS links always use `https://sparks.codezela.com`.

Each article includes its original title/description overrides, canonical URL, publication and modification dates, Open Graph and Twitter fields, BlogPosting JSON-LD and breadcrumbs. Pages use WebPage JSON-LD. Home includes WebSite and Organization metadata. Search and Studio are excluded from indexing. Alternate Vercel hostnames receive `X-Robots-Tag: noindex, nofollow`; the actual Sparks domain remains indexable.

One source article deliberately overrides its canonical URL. Its original canonical is preserved and that duplicate URL is omitted from the sitemap, matching the source's 373-post sitemap. All 374 article routes still work. The detailed inventory records this exception.

One original Unsplash cover already returned 404. Its recorded replacement reuses an owned AI cover from the same publication. Article text and metadata are unchanged. See `src/data/media-overrides.json` and `docs/migration-inventory.json`.

The new site does not call Ghost when rendering, searching, signing in, editing or publishing. Ghost is referenced only by the optional one-time import and source-comparison scripts. Those scripts are not site services and may be removed once the migration is accepted.

## Database changes and backups

Schema changes live in numbered `migrations/*.sql` files. The migration runner records SHA-256 checksums and refuses modified migrations that have already been applied. Create a new migration for subsequent changes.

```sh
bun run db:migrate
bun run db:backup
```

Backups contain articles and revisions, including drafts, and are written privately to `.local/backups`. Copy them to your own protected backup storage. They intentionally exclude passwords and environment secrets. Enable the retention/PITR options appropriate to your Neon plan separately. Blob uploads are media assets and should be included in your media backup process; repository media is already versioned.

`db:seed` inserts missing imported entries and never overwrites existing edits. It is a bootstrap step, not a synchronization command. `import:ghost` refreshes source files and media on disk and must be reviewed before reseeding. Do not use an import to overwrite live editorial work.

## Deployment and the custom domain

The Vercel project is `sparks-by-codezela`, under `sayuruakashs-projects` in the requested account. The production domain is `sparks.codezela.com`. The supplied Neon project is connected directly; no Neon marketplace project is required.

Vercel uses the Astro framework, `bun install --frozen-lockfile`, `bun run build`, Node 24 and the `iad1` region. The project has its own attached public Blob store. Production environment values are configured in Vercel, separate from local `.env`.

For a source deployment:

```sh
bunx vercel link --project sparks-by-codezela --scope sayuruakashs-projects
bunx vercel deploy --prod --scope sayuruakashs-projects
```

The connected GitHub repository can also trigger Vercel deployments after commits are pushed. No GitHub Actions workflow is needed. Apply new SQL migrations deliberately before deploying code that requires them. Never migrate or reseed implicitly on every server request or build.

The project has the custom domain attached. DNS must use the exact CNAME shown in Vercel's domain settings, with any old Ghost record removed. Keep the existing Cloudflare nameservers; they do not need to move to Vercel. Vercel manages the HTTPS certificate. DNS caches may briefly show different origins during a switch.

Before cancelling Ghost, check that the public domain serves this site, Studio login and publishing work, the migration report is clean, and independent copies of any Ghost-only member or operational data you need have been exported. This repository migrates the public publication; it does not implement Ghost memberships, paid subscriptions or email newsletters.

## Verification

Run quality gates manually before deploying:

```sh
bun run format:check
bun run check
bun test
bun audit
bun run build
```

The test suite executes the actual repository SQL against embedded Postgres. It covers draft privacy, search, revision recording, stale saves, immutable published URLs, duplicate slugs, scheduled visibility, history restoration, unpublishing, separate page archives, sanitization, signed sessions and password verification.

While the original Ghost source is available, compare every migrated entry and crawl the hosted site:

```sh
bun run verify:migration https://sparks.codezela.com
```

The script compares bodies, dates, excerpts, taxonomy and SEO fields against the original Content API, checks Neon entries, and crawls all 375 public routes, covers and original sitemap URLs. Reports are saved in `docs/verification`. After Ghost is removed, use the committed migration evidence and normal application checks; the optional source comparison naturally needs its old source to exist.

Screenshots, migration reports and the release report are kept in `docs/verification`. A local build, a Vercel Ready status and a successful live crawl are separate verification steps. Check all three after infrastructure changes.

## Repository map

```text
src/components/          Public UI and Studio React islands
src/layouts/             Public SEO layout and private Studio layout
src/lib/                 Validation, authentication, data queries and formatting
src/pages/               Public routes, auth routes and private Studio endpoints
src/data/                Imported content, public metadata and media inventory
src/styles/              Minimal public and Studio styling
public/media/            Owned migrated WebP assets
migrations/              Versioned Postgres schema changes
scripts/                 Migration, bootstrap, admin and verification utilities
tests/                   Publishing, content and authentication contracts
docs/                    Migration, design and release evidence
AGENTS.md                Rules for future work on this publication
```

Production output, dependencies, development databases, passwords and environment files are ignored by Git. Keep the source tree intentional and preserve the original publication content when making future changes.
