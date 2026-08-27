# Bunny dev deployment

This setup deploys the complete static Astro site together with the contact API,
availability API, protected appointment administration, and Bunny Database.
The existing Cloudflare deployment remains independent.

## 1. Build and publish the image

Run the GitHub Actions workflow **Build Bunny dev image**. It tests the Node
runtime, builds a `linux/amd64` image, and publishes these tags:

- `ghcr.io/thepixelsl/migra-bunny-dev:dev`
- `ghcr.io/thepixelsl/migra-bunny-dev:sha-<commit>`

Use the immutable `sha-<commit>` tag for a reproducible deployment. Keep the
package private. In Bunny, add a GitHub image registry with a classic GitHub PAT
that has only `read:packages`, then select that private registry for the
container.

## 2. Create the database before confirming the app

In Bunny, open **Edge Platform > Database**, create `artbild-dev`, and choose
Frankfurt. Create the Magic Containers app as a single-region deployment in
Frankfurt as well. Under **Access**, generate a full-access token.
Add these two values to the container as secrets:

- `BUNNY_DATABASE_URL`
- `BUNNY_DATABASE_AUTH_TOKEN`

The runtime creates its required tables and indexes at startup. It deliberately
does not start without a database URL, because local container storage is lost
when Bunny restarts or replaces a pod.

## 3. Container values in Magic Containers

- Container name: `web`
- Registry: the private GitHub registry added above
- Image: `thepixelsl/migra-bunny-dev`
- Tag: the selected `sha-<commit>` tag
- Persistent volume: none
- Startup command and arguments: leave empty

Add a **CDN endpoint**:

- Name: `web`
- Container port: `8080`
- SSL for origin: off
- Sticky sessions: off

Do not create a separate Pull Zone. The CDN endpoint creates the Bunny dev URL.

## 4. Environment variables

Copy the names from `bunny.env.example`. Replace every placeholder. Store the
database token, admin password, SMTP password, hash salt, and—when configured—
the admin session secret as secrets. Keep `DEV_NOINDEX=true` for the development
URL.

`/admin-termine/` redirects unauthenticated browsers to `/admin-login/`. The
form creates a signed, `HttpOnly`, `Secure`, `SameSite=Lax` session cookie that
expires after twelve hours. `ADMIN_SESSION_SECRET` is optional but recommended
as an independent long random secret; when it is omitted, the runtime signs
sessions with `ADMIN_PASSWORD`. Preemptive HTTP Basic authorization remains a
fallback for command-line clients, but the server no longer sends a Basic-Auth
browser challenge.

`AGENT_API_CLIENTS_JSON` is optional. It maps a readable client label to a
Bearer token, for example
`{"OpenAI Terminassistent":"replace-with-a-long-random-agent-token"}`. Store
the complete JSON value as a secret. Requests without a matching token remain
allowed, but any bot category inferred from the User-Agent is displayed as
unverified in `/admin-termine/`.

Request an outbound port 465 unlock from Bunny Support before enabling the
contact form. Configure the STRATO SMTP secrets and verify delivery with a real
end-to-end test. The application deliberately has no HTTP relay or webhook
fallback; without a working direct SMTP transport, it returns a temporary
configuration error and does not accept the request as delivered. Magic
Containers blocks ports 25, 465, 587, and 2525 by default.

## 5. Health checks

Configure all checks as HTTP GET on port `8080`:

- Startup: `/readyz`
- Readiness: `/readyz`
- Liveness: `/healthz`

The readiness endpoint verifies the database connection. The liveness endpoint
only verifies that the web process is responsive.

## 6. Verification after deployment

Check the generated `https://...bunny.run` URL, then verify:

1. Homepage, portfolio, galleries, legal pages, and a real 404.
2. `X-Robots-Tag: noindex, nofollow, noarchive` on the dev URL.
3. `/admin-termine/` redirects anonymous browsers to `/admin-login/`, accepts
   the configured form login, and protects the admin APIs with the resulting
   session cookie.
4. Blocking and unblocking a test date appears in `/api/availability`.
5. A contact request is stored in Bunny Database and delivered by email.
