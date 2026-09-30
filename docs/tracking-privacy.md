# Tracking privacy release boundary

All five optional services currently have a closed gate in `src/config/trackingRelease.mjs`. Supplying an ID or restoring consent cannot open a gate. The explicit development test mode can exercise integrations, but a production build always uses the reviewed gates.

Each provider requires its own consent. Google Analytics and Google Ads have separate destinations and storage signals. Meta cannot grant Google advertising consent. `ad_personalization` stays denied. The Tag Manager is a technical dependency of Meta/Clarity only.

Consent expires after 180 days and requires the current text version. Revocation is propagated to other tabs; loaded SDK execution contexts end through a controlled reload. Reachable first-party identifiers are removed. Revocation cannot recall requests already sent or delete data from provider systems.

Only a successful contact-backend response may generate a lead. A transient event identifier deduplicates the browser event. Form values and hashes are not permitted in measurement payloads. OpenAI remains isolated in an opaque sandbox and may not access the parent form or storage.

## Verification

- `playwright.privacy-release.config.ts`: test the released build with closed gates; all 32 attempted selections must stay blocked. Run against a preview and against the public host after deployment. Contact submission is intercepted; no mail is sent.
- `playwright.privacy.config.ts`: exercise consent logic and actual provider scripts. Retrieve public SDK fixtures with `node scripts/capture-privacy-sdk-fixtures.mjs`. A real SDK must emit an expected measurement before its positive case can pass. Requests are intercepted before provider delivery.
- `PRIVACY_PRODUCTION_ORIGIN=1` mirrors local port 4341 under the production hostname inside the test browser. This is necessary to detect hostname-based provider rules that localhost would miss. Never forward synthetic measurement requests to providers.

The development test environment needs the existing GTM/GA/Ads identifiers and a verified conversion label through the documented `PUBLIC_*` configuration. Optional OpenAI tests require the existing authorized pixel identifier. Do not invent identifiers or use an unrelated account to make tests pass.

Before opening a gate, verify the actual provider account, automatic data matching, conversion conditions, deduplication, cookies, retention, current contracts/transfer grounds, evidence of consent, and matching privacy text. All applicable real transport cases must pass. Failed or silent SDK measurements are not acceptance.

The detailed dated implementation report, account exports, SDK snapshots and browser traces are kept locally under `reports/ads-datenschutz-2026-09-30/`; they are deliberately excluded from this public repository. This document records the technical boundary, not a legal assurance or proof of provider-side deletion.
