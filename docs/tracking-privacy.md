# Consent-dependent tracking

The release enables Google Analytics, Google Ads, Microsoft Clarity and OpenAI Ads only after a separate, current consent. Meta remains unavailable. Tests exercise these same release gates; setting an ID or environment variable cannot enable another provider.

GA4 and Google Ads use separate destinations and storage signals. `ad_personalization` is always denied. The Ads conversion label belongs to the manually triggered, backend-confirmed contact action; the former contact-page URL action was removed. There is no additional primary GA4 import of this lead.

Clarity loads directly into the verified Artbild website project, with analytics consent granted and advertising storage denied. Its project uses strict text masking, reinforced by `data-clarity-mask` on the document before loading. Clarity does not run on URLs/referrers containing query parameters or fragments, or the portfolio and church-finder pages that change filter URLs. The user's consent remains available for later eligible pages. GTM is not needed by any currently released service. Before any future Meta release, remove the legacy Clarity tag in GTM to prevent duplicate project delivery.

Only backend-confirmed contact submissions reach OpenAI. Its SDK runs in an opaque sandbox without access to the parent DOM, form values, data layer or storage. Every event includes the documented personalization opt-out. The existing pixel and `lead_created` event were verified in the accessible website account. Its public configuration still enables automatic advanced matching; the account edit screen exposes no switch to change it. The sandbox prevents that feature from reading customer information. Tests use this actual configuration, rather than pretending matching is disabled. This remains an explicit deviation from the implementation plan's requested account setting.

Consent expires after 180 days, requires the current text version, and is checked before events. Cross-tab revocation ends loaded SDK contexts through a reload and removes reachable first-party identifiers. Revocation cannot recall requests already sent or delete data from provider systems. Only the consent choices, timestamp and version are stored locally; the associated notice/version is retained in Git. No central visitor register is created, following [IT-Recht Kanzlei's consent-proof guidance](https://www.it-recht-kanzlei.de/faq-einwilligung-cookies.html).

At the owner's explicit request, GA4 keeps its existing 14-month event/user retention and resets user retention with renewed activity. The website's GA cookie limit remains 180 days without renewal. The privacy notice distinguishes these periods. This differs from the two-month/reset-off recommendation in [Datenschutzkanzlei's GA guidance](https://www.datenschutzkanzlei.de/google-analytics-datenschutzkonform-verwenden/).

## Verification

- `playwright.privacy.config.ts`: all 32 attempted service combinations, first visit/rejection, successful and failed submissions, duplicate prevention, URL/form canaries, narrow screen, revocation and delayed loaders. Real SDK tests require positive measurement requests and intercept them before provider delivery.
- `PRIVACY_PRODUCTION_ORIGIN=1` mirrors the local site under its public hostname. Set `PRIVACY_LOCAL_ORIGIN` to test a built preview. Without that flag, `ASTRO_URL` tests the actual host.
- `playwright.privacy-release.config.ts`: built/public routes, available consent choices, current privacy notice, safe contact handling and release gates across Chromium, Firefox and WebKit.
- `node scripts/capture-privacy-sdk-fixtures.mjs`: dated public SDK snapshots and hashes. No credentials or synthetic conversions are sent to providers.

An intercepted SDK request proves browser emission, not receipt or attribution by a provider. Account checks and sensitive evidence stay in the ignored `reports/tracking-activation-2026-10-01/` directory. Earlier results remain in `reports/ads-datenschutz-2026-09-30/`. This is a technical implementation and documented configuration, not a legal certification.
