import { readFile, stat } from "node:fs/promises";
import { createSign } from "node:crypto";

export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"];
export class GoogleAccessError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export async function readPrivateFile(path) {
  if (!path) throw new GoogleAccessError("credentials_missing");
  const info = await stat(path);
  if ((info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) throw new GoogleAccessError("credentials_permissions");
  return readFile(path, "utf8");
}
export async function jsonRequest(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt)); continue;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new GoogleAccessError(response.status === 401 || data.error === "invalid_grant" ? "authorization_expired"
      : response.status === 403 ? "permission_or_api_disabled" : "google_api_error", response.status);
    return data;
  }
}
export async function googleClient(path, scopes = GOOGLE_SCOPES) {
  const credentials = JSON.parse(await readPrivateFile(path));
  return googleClientWithCredentials(credentials, scopes);
}
export function googleClientWithCredentials(credentials, scopes = GOOGLE_SCOPES) {
  let cached;
  async function token() {
    if (cached?.expires > Date.now() + 60000) return cached.value;
    const body = new URLSearchParams();
    if (credentials.type === "service_account") {
      const now = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
      const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: credentials.client_email,
        scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
      const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.private_key, "base64url");
      body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"); body.set("assertion", `${unsigned}.${signature}`);
    } else if (credentials.refresh_token && credentials.client_id && credentials.client_secret) {
      body.set("grant_type", "refresh_token");
      for (const key of ["client_id", "client_secret", "refresh_token"]) body.set(key, credentials[key]);
    } else throw new GoogleAccessError("credentials_format");
    const result = await jsonRequest("https://oauth2.googleapis.com/token", { method: "POST", body });
    if (!result.access_token) throw new GoogleAccessError("authorization_expired");
    cached = { value: result.access_token, expires: Date.now() + Number(result.expires_in || 3600) * 1000 };
    return cached.value;
  }
  return async (url, body, extraHeaders = {}, method) => jsonRequest(url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
