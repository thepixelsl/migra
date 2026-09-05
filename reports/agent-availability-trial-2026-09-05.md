# Agent availability trial release, 2026-09-05

The isolated public route `/agenten-test/` tests autonomous navigation from a month index to a single live date result. Source commit: `3cf3a42ceac1a06a9a951d12dd31f79eed18a1c8`. The regular `/fuer-agenten/` page was byte-identical in before/after public checks.

- `npm run test:bunny`: 40 passing tests. `npm run build`: passed.
- Production workflow: https://github.com/thepixelsl/migra/actions/runs/33964850531, successful for the source commit.
- Image: `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-3cf3a42`, digest `sha256:05a3d65bf9b91658f096b3ff1aeafd81921022d2da2b038009e3a97931d52274`.
- Only Bunny application `artbild-dev`, container `web`, was switched. Final state: Active, one ready Frankfurt pod `vdV0FpQX082Z49`, old pods absent.
- Public trial pages: 200; health/readiness: 200; protected admin API: 401; unknown route: 404.

## Required external CDN configuration

The server's `no-store` header alone was overridden by the existing HTML CDN rule. Pull zone `6278247` now has:

- Dynamic Private Paths (`2de7e725-89d1-4f9a-b2b0-1bd933325816`): existing conditions plus `*/agenten-test/*`; existing actions remain cache time 0 and `private, no-store, no-cache, must-revalidate`.
- HTML Revalidate (`5e2870a8-68cf-4291-874c-c99156f4c4b5`): ALL of ANY URL `*/` and NONE URL `*/agenten-test/*`. Other HTML pages retain their previous behavior. Asset rules were unchanged.

After both scoped changes, all six previously fetched test URLs returned BYPASS/no-store, and repeated date GETs returned different receipts. No cache purge was performed. These dashboard changes must be preserved if CDN rules are recreated from another source.

Public HEAD requests still produced a receipt through the CDN, despite the origin handler's side-effect-free HEAD behavior. Do not assume the server-only HEAD test proves identical CDN behavior.

## Agent evaluation

Fresh free web chats received only the trial entry URL, the desired date and the task. Gemini completed an autonomous current-date check; its returned receipt, result and timestamp matched the database. Claude read the entry but failed to fetch the month, reporting a 404-type tool error despite independent HTTP 200 checks. One short follow-up diagnostic did not trigger a new Claude fetch. This is not a successful joint acceptance or a general reliability measurement.

The detailed German report, chat references and read-only audit evidence remain in the local task artifacts outside this repository. Before integrating the trial into the regular agent page, investigate Claude's failing month request using actual request evidence; also assess URL normalization and the observed CDN handling of HEAD.

## Claude compatibility follow-up

CDN request logs correlated the initial failed month fetch with a slashless path that the server returned as 404. Valid month/day trial URLs now accept either trailing-slash spelling directly. Invalid dates and malformed double-slash paths remain rejected; both aliases share the existing calendar, date budget and receipt audit.

- Source commit: `a90b309987bc4b21990644cc215725af49f35a6f`; 41 Bunny tests and production build passed.
- Workflow https://github.com/thepixelsl/migra/actions/runs/33968413873 succeeded for that exact commit.
- Image `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-a90b309`, digest `sha256:9e4b528f1e7c5b00d432ed49ae96753b7ed0b824fc342970acbb5c5cc458b7b3`.
- Only `artbild-dev` / `web` switched. Final state Active, one ready Frankfurt pod `A7scFIqCHM7fLQ`, old pod absent.
- Public month and day URLs with/without slash: 200, no redirect, BYPASS/no-store; two date responses have fresh distinct receipts and identical shared remaining quota. Health/readiness 200, protected admin 401, missing route 404.
- No additional CDN rule change or cache purge.

Four additional short free Claude prompts were used: two direct diagnostics, then two independent autonomous tasks. The previously failing month still produced a Claude tool error after the public correction. A different month succeeded autonomously from the entry URL, including a live unavailable result whose unique receipt and millisecond timestamp matched the database. No subordinate URL was supplied in that successful prompt. The client identity remains unverified.

This establishes that free Claude can traverse the linked route; it does not establish a general reliability rate, the exact cause of its persistent error, or freshness after a future calendar change behind any provider-side fetch cache. It also does not isolate whether slash tolerance caused the successful different-month test. The regular agent page remains unchanged. Full diagnostic evidence stays in the local German follow-up report.
