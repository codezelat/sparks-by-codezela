# Google Analytics verification

Verified 12 October 2026 (Asia/Colombo) on production deployment `dpl_5omZjXxVZ3bqJvn7pcETirxN24nz`.

`PUBLIC_GA_ID=G-1FHLXFGZRV` is configured in Vercel Production. The shared public layout loads one asynchronous Google tag and one configuration command. Production builds retain the configured ID. No duplicate manual page-view event is added: the Google tag's configuration sends the page view, as documented in [Google's page-view guide](https://developers.google.com/analytics/devguides/collection/ga4/views).

`analytics-http.json` verifies the tag appears once on the homepage, About, an article and an author archive. It is absent from Studio login, search, errors and the alternate Vercel host. The shared condition also excludes local development and private draft previews.

`analytics-browser.json` records real Browser/IAB network evidence, with client identifiers omitted. The Google tag returned HTTP 200. Both homepage load and a normal article-link navigation sent exactly one `page_view` request to `www.google-analytics.com/g/collect` for the correct measurement ID and page URL. Google returned HTTP 204 for both events. The browser reported no errors. This verifies live browser collection and acceptance, rather than merely finding a script in HTML.

The Analytics property's Realtime/report UI was not accessed. Account-level reporting settings and subsequent report processing are outside this site-side verification. No property, permission or billing setting was changed. The temporary browser verification tab was closed.

Build, type checks (zero errors/warnings/hints), all 16 tests, formatting, dependency audit and live route/header checks passed. README documents changing or disabling the measurement ID and redeploying. No GitHub Actions or new dependencies were introduced.

To repeat the public markup checks, run `bun scripts/verify-analytics.ts`. Browser network inspection verifies collection separately.
