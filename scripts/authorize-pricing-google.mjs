import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GOOGLE_SCOPES, jsonRequest, readPrivateFile } from "./lib/pricing-google.mjs";

// Run interactively on the Mac. The user completes Google's consent screen.
// Existing Keyword Planner authorization is never overwritten or expanded.
const clientFile = process.env.PRICING_OAUTH_CLIENT_FILE;
const output = process.env.PRICING_GOOGLE_CREDENTIALS;
if (!clientFile || !output) throw Error("Set PRICING_OAUTH_CLIENT_FILE and PRICING_GOOGLE_CREDENTIALS to private absolute paths.");
if (resolve(clientFile) === resolve(output)) throw Error("OAuth client and output must be different files.");
const document = JSON.parse(await readPrivateFile(clientFile));
const client = document.installed;
if (!client?.client_id || !client?.client_secret) throw Error("A Google Desktop OAuth client is required.");
const scopes = [...GOOGLE_SCOPES, ...(process.argv.includes("--admin") ? ["https://www.googleapis.com/auth/analytics.edit"] : [])];
const verifier = randomBytes(32).toString("base64url"), state = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
let finished = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const incomingState = url.searchParams.get("state") || "";
  if (finished || url.pathname !== "/oauth/callback" || incomingState.length !== state.length
    || !timingSafeEqual(Buffer.from(incomingState), Buffer.from(state))) { response.writeHead(400); response.end("Invalid callback."); return; }
  finished = true;
  try {
    if (!url.searchParams.get("code")) throw Error("Consent was not completed.");
    const tokens = await jsonRequest("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({
      grant_type: "authorization_code", client_id: client.client_id, client_secret: client.client_secret,
      code: url.searchParams.get("code"), redirect_uri: redirect, code_verifier: verifier,
    }) });
    if (!tokens.refresh_token) throw Error("No refresh token was returned.");
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    // Refuse to overwrite an existing credential file.
    await writeFile(output, JSON.stringify({ type: "authorized_user", client_id: client.client_id,
      client_secret: client.client_secret, refresh_token: tokens.refresh_token }), { flag: "wx", mode: 0o600 });
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("Google-Zugang lokal gespeichert. Dieses Fenster kann geschlossen werden.");
    console.log("Authorization saved privately; no credential values are printed.");
  } catch { response.writeHead(400); response.end("Authorization not saved. Check API/consent configuration and output path."); process.exitCode = 1; }
  finally { server.close(); clearTimeout(timeout); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const redirect = `http://127.0.0.1:${server.address().port}/oauth/callback`;
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
for (const [key, value] of Object.entries({ client_id: client.client_id, redirect_uri: redirect, response_type: "code",
  scope: scopes.join(" "), access_type: "offline", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256" })) url.searchParams.set(key, value);
console.log("Open this Google authorization URL in your browser and approve the listed scopes yourself:");
console.log(url.href);
const timeout = setTimeout(() => { server.close(); console.error("Authorization timed out."); process.exitCode = 1; }, 10 * 60 * 1000);
