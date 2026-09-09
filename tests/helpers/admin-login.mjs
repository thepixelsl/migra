import assert from "node:assert/strict";
import { TOTP } from "otpauth";

export const TEST_ADMIN_SECRET = Buffer.alloc(32, 17).toString("base64url");
export const TEST_SETUP_TOKEN = Buffer.alloc(32, 23).toString("base64url");
export const TEST_ADMIN_ORIGIN = "https://admin.example";
export const cookiePair = (response) => String(response.headers.get("set-cookie") || "").split(";", 1)[0];
export const csrfFrom = (html) => html.match(/name="csrf" value="([^"]+)"/)?.[1] || "";
export const secretFrom = (html) => html.match(/<code class="secret">([^<]+)<\/code>/)?.[1] || "";
export const totpCode = (secret, timestamp) => new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 }).generate({ timestamp });

export function adminTestClient(baseUrl, origin = TEST_ADMIN_ORIGIN) {
  return {
    get(cookie = "", path = "/admin-login/") {
      return fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
    },
    post(data, cookie = "", path = "/admin-login/", extraHeaders = {}) {
      return fetch(`${baseUrl}${path}`, {
        method: "POST", redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
        body: new URLSearchParams(data),
      });
    },
  };
}

export async function enrollTestAdmin(baseUrl, timestamp, origin = TEST_ADMIN_ORIGIN) {
  const web = adminTestClient(baseUrl, origin);
  let r = await web.post({ username: "york", password: "dev-secret" });
  assert.equal(r.status, 303);
  let cookie = cookiePair(r);
  let html = await (await web.get(cookie)).text();
  r = await web.post({ action: "authorize-setup", setup_token: TEST_SETUP_TOKEN, csrf: csrfFrom(html) }, cookie);
  assert.equal(r.status, 303);
  cookie = cookiePair(r);
  html = await (await web.get(cookie)).text();
  const secret = secretFrom(html);
  assert.ok(secret);
  r = await web.post({ action: "confirm-setup", code: totpCode(secret, timestamp), csrf: csrfFrom(html) }, cookie);
  assert.equal(r.status, 303);
  cookie = cookiePair(r);
  html = await (await web.get(cookie)).text();
  const recoveryCodes = [...html.matchAll(/<li><code>([^<]+)<\/code><\/li>/g)].map((m) => m[1]);
  assert.equal(recoveryCodes.length, 10);
  r = await web.post({ action: "acknowledge", saved: "yes", csrf: csrfFrom(html) }, cookie);
  assert.equal(r.status, 303);
  return { cookie: cookiePair(r), secret, recoveryCodes, response: r };
}

export async function loginTestAdmin(baseUrl, secret, timestamp, origin = TEST_ADMIN_ORIGIN) {
  const web = adminTestClient(baseUrl, origin);
  const primary = await web.post({ username: "york", password: "dev-secret" });
  assert.equal(primary.status, 303);
  const pending = cookiePair(primary);
  const html = await (await web.get(pending)).text();
  const response = await web.post({ action: "verify", code: totpCode(secret, timestamp), csrf: csrfFrom(html) }, pending);
  assert.equal(response.status, 303);
  return { cookie: cookiePair(response), response, pending };
}
