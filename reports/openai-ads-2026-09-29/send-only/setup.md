# OpenAI measurement restricted to successful contact submissions

This update supersedes the in-page SDK and automatic contact-matching description in the original setup report. Scope explicitly authorized by the owner: retain conversion measurement, remove email/input-field collection, measure at most successful sending, simplify the banner truthfully, and deploy to production.

## Implementation

- Astro frontend and existing Bunny Node server; existing OpenAI adapter and confirmed `artbild:form_success` boundary retained. No additional backend, credentials, API key, database or queue.
- Only `lead_created` / `customer_action` is measured, once per document, after `/api/contact` confirms success and the separate OpenAI consent remains granted. Page views, field edits, clicks without successful sending, failed requests, duplicate notifications and pre-consent events are not measured.
- The official SDK is loaded only at that success boundary in `/openai-conversion.html`, an empty `sandbox="allow-scripts"` iframe. `allow-same-origin` is intentionally absent. Browser origin isolation denies access to the parent form, cookies and storage. The frame fails closed when embedded without this isolation or opened as a standalone document.
- The sender passes only a fixed message type and public pixel ID. No user object, name, email, phone, message, date, venue or other form value is passed. The account's automatic matching flag may remain enabled, but its SDK cannot access the actual page or any input field.
- Production CSP independently sandboxes the measurement document. OpenAI script/connect destinations are removed from the main site's CSP and permitted only inside the dedicated frame. The frame has `no-referrer`, `no-store`, and `noindex` responses.
- `opt_out: true` remains on every lead event, preserving the visitor's stated objection to future user-level personalization. The SDK also emits its own initialization/diagnostic telemetry; these are not additional site interaction measurements.
- The documented opaque `oppref` ad reference is retained by the first-party adapter for up to 30 days after consent and forwarded only as the measurement document's `oppref` URL parameter. The SDK itself derives its transport fields from that URL. Existing consented references retain their original expiry on ordinary navigation. No arbitrary query parameters, fragment or form values are forwarded.
- `source_url` consequently identifies the fixed measurement document, not `/kontakt/`. This is deliberate and is covered by intercepted transport verification.
- The previous persistent `__obref` cookie is removed. The isolated SDK cannot create a persistent first-party browser identifier; it may produce a temporary reference for this one measurement. Lack of persistent browser/contact matching can reduce attribution coverage. Do not describe this integration as anonymous: network metadata and ad attribution remain. The short banner states the limited event and absence of form contents; technical details remain in the privacy notice.
- Withdrawal destroys the sandbox and any pending download/queue, deletes identifiers and uses the existing reload/cross-tab withdrawal behavior. Existing transmitted requests cannot be recalled.
- Supported commerce/registration/subscription/appointment events are inapplicable to this contact flow. `page_viewed` is intentionally omitted at the owner's request. No CAPI integration, secret or deduplication across browser/server is needed.

## Source documentation

- https://developers.openai.com/ads/measurement-pixel (documented SDK init, consent, lead event, opt-out and automatic matching behavior)
- https://developers.openai.com/ads/supported-events
- https://developers.openai.com/ads/conversions-api (server-side alternative inspected, not implemented)

The iframe isolation and first-party attribution bridge are site integration code, not a new SDK option. No undocumented SDK disable flag, modified SDK or direct imitation of its HTTP transport is used.

## Validation before deployment

- 11 OpenAI browser tests, including actual official SDK 0.1.41 with `automatic_advanced_matching_enabled: true` and intercepted network transport.
- Synthetic values remain in the parent form during the real-SDK test. Neither those values nor their email/name SHA-256 hashes occur in the outbound payload. The sandbox's inability to read the parent form is independently asserted.
- Only the lead interaction is emitted; opt-out and ad attribution survive. A later page still reuses the consented ad reference. No test submits a real inquiry or sends a conversion to OpenAI.
- 21 existing consent tests, 5 privacy tests (one rerun with matching synthetic provider environment), 64 Bunny/runtime tests, 8 tracking configuration tests, complete production build and 4 content checks.
- The initial payload-count assertion was refined to distinguish the SDK's technical lifecycle/diagnostic records from the single lead event; the resulting complete payload is still checked for excluded data.
- Public production verification is recorded separately after deployment.

Deployment review warning: this technical verification does not establish legal compliance for every processing purpose. Review the final consent, contractual and privacy requirements before any later expansion of data collection. This scoped production release is explicitly authorized by the owner.
