import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  hkdfSync, randomBytes, timingSafeEqual,
} from "node:crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import {
  reserveAdminAuthenticationAttempt, clearAdminAuthenticationAttempts,
  adminAuthenticationRetryAfterSeconds,
} from "./admin-auth-rate-limit.mjs";
import { adminAuthPage } from "./admin-auth-pages.mjs";

export const ADMIN_SESSION_SECONDS = 4 * 60 * 60;
export const ADMIN_IDLE_MS = 30 * 60 * 1000;
const CHALLENGE_MS = 10 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");
const safeEqual = (left, right) => timingSafeEqual(
  createHash("sha256").update(String(left)).digest(),
  createHash("sha256").update(String(right)).digest(),
);

export function adminAuthPath(pathname) {
  return /^\/admin-(?:login|logout|security)\/?$/.test(pathname);
}

export function adminConfiguration(env) {
  const username = String(env.ADMIN_USERNAME || "");
  const password = String(env.ADMIN_PASSWORD || "");
  const sessionSecret = String(env.ADMIN_SESSION_SECRET || "");
  const setupToken = String(env.ADMIN_MFA_SETUP_TOKEN || "");
  let origin;
  try {
    const parsed = new URL(env.ADMIN_PUBLIC_ORIGIN || "https://artbild-fotografie.de");
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(loopback && env.NODE_ENV !== "production" && parsed.protocol === "http:")) throw new Error();
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
    origin = parsed.origin;
  } catch { origin = null; }
  const configured = Boolean(username && password && TOKEN_PATTERN.test(sessionSecret)
    && sessionSecret !== password && origin);
  return {
    configured, username, password, sessionSecret, origin,
    setupToken: TOKEN_PATTERN.test(setupToken) && setupToken !== sessionSecret && setupToken !== password ? setupToken : "",
    secure: !origin?.startsWith("http:"),
    accountId: hash(username),
    authBinding: createHmac("sha256", sessionSecret).update(`admin-credentials-v2\n${username}\n${password}`).digest("hex"),
  };
}

export function createAdminAuthentication({ env, database, now = Date.now }) {
  const config = adminConfiguration(env);
  const client = database.client;
  const cookieName = config.secure ? "__Host-artbild_admin_session" : "artbild_admin_session_dev";
  const key = config.configured
    ? Buffer.from(hkdfSync("sha256", Buffer.from(config.sessionSecret, "base64url"), config.accountId, "artbild-admin-encryption-v1", 32))
    : null;

  function encrypt(value, purpose) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`${config.accountId}:${purpose}`));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  }
  function decrypt(value, purpose) {
    const [iv, tag, data, extra] = String(value).split(".");
    if (!iv || !tag || !data || extra) throw new Error("invalid_admin_ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(`${config.accountId}:${purpose}`));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"));
  }
  const recoveryHash = (code) => createHmac("sha256", key)
    .update(`recovery:${config.accountId}:${String(code).replace(/[-\s]/g, "").toUpperCase()}`).digest("hex");
  const otp = (secret) => new TOTP({ issuer: "Artbild-Fotografie", label: config.username, algorithm: "SHA1", digits: 6, period: 30, secret });
  function validCounter(secret, token, lastCounter = -1) {
    const normalized = String(token).replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalized)) return null;
    const timestamp = now();
    const delta = otp(secret).validate({ token: normalized, timestamp, window: 1 });
    const counter = Math.floor(timestamp / 30000) + (delta ?? 0);
    return delta !== null && counter > lastCounter ? counter : null;
  }
  async function transaction(callback) {
    const tx = await client.transaction("write");
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally { tx.close(); }
  }
  async function account(db = client) {
    const result = await db.execute({ sql: "SELECT * FROM admin_mfa_accounts WHERE account_id = ?", args: [config.accountId] });
    return result.rows[0] || null;
  }
  function readToken(request) {
    const matches = (request.headers.get("cookie") || "").split(";")
      .map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`));
    if (matches.length !== 1) return "";
    const value = matches[0].slice(cookieName.length + 1);
    return /^v2\.[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
  }
  const cookie = (token, maxAge) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? "; Secure" : ""}`;
  async function session(request, db = client, touch = false) {
    const token = readToken(request);
    if (!token || !config.configured) return null;
    const result = await db.execute({
      sql: `SELECT * FROM admin_login_sessions WHERE token_hash = ? AND account_id = ?
        AND auth_binding = ? AND expires_at > ? AND (kind != 'full' OR last_seen > ?)`,
      args: [hash(token), config.accountId, config.authBinding, now(), now() - ADMIN_IDLE_MS],
    });
    const row = result.rows[0];
    if (!row) return null;
    if (row.kind === "full" && !(await account(db))) return null;
    if (touch && row.kind === "full") {
      const touched = await db.execute({
        sql: "UPDATE admin_login_sessions SET last_seen = ? WHERE token_hash = ? AND expires_at > ? AND last_seen > ?",
        args: [now(), row.token_hash, now(), now() - ADMIN_IDLE_MS],
      });
      if (Number(touched.rowsAffected) !== 1) return null;
    }
    return row;
  }
  async function newSession(db, kind, payload = null) {
    const token = `v2.${randomToken()}`;
    const tokenHash = hash(token);
    const maxAge = kind === "full" ? ADMIN_SESSION_SECONDS : CHALLENGE_MS / 1000;
    const row = {
      token_hash: tokenHash, csrf: randomToken(), kind,
      payload_cipher: payload === null ? null : encrypt(payload, tokenHash),
      expires_at: now() + maxAge * 1000,
    };
    await db.execute({
      sql: `INSERT INTO admin_login_sessions
        (token_hash, account_id, auth_binding, kind, csrf, payload_cipher, expires_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [tokenHash, config.accountId, config.authBinding, kind, row.csrf, row.payload_cipher, row.expires_at, now()],
    });
    return { row, token, maxAge };
  }
  async function replaceSession(db, previous, kind, payload = null) {
    const removed = await db.execute({ sql: "DELETE FROM admin_login_sessions WHERE token_hash = ?", args: [previous.token_hash] });
    if (Number(removed.rowsAffected) !== 1) throw new Error("admin_challenge_already_used");
    return newSession(db, kind, payload);
  }
  function response(body, status = 200, headers = {}) {
    return new Response(body, { status, headers: {
      "Cache-Control": "private, no-store", "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive", ...headers,
    } });
  }
  function redirect(path, issued) {
    const headers = { Location: new URL(path, config.origin).href };
    if (issued) headers["Set-Cookie"] = cookie(issued.token, issued.maxAge);
    return response(null, 303, headers);
  }
  const unavailable = () => response(adminAuthPage({ stage: "unavailable" }), 503);
  async function page(row, error = "", status = 200) {
    const stage = row?.kind || "password";
    let extra = {};
    if (["setup", "replace"].includes(stage)) {
      const payload = decrypt(row.payload_cipher, row.token_hash);
      extra = { secret: payload.secret, qr: await QRCode.toDataURL(otp(payload.secret).toString(), { width: 256, margin: 2, errorCorrectionLevel: "M" }) };
    }
    if (stage === "backup") extra.codes = decrypt(row.payload_cipher, row.token_hash).codes;
    return response(adminAuthPage({ stage, csrf: row?.csrf, error, setupAvailable: Boolean(config.setupToken), ...extra }), status);
  }
  function validWriteOrigin(request) {
    return request.headers.get("origin") === config.origin
      && !["cross-site", "none"].includes(request.headers.get("sec-fetch-site"));
  }
  async function reserve(scope) {
    const result = await reserveAdminAuthenticationAttempt(database.d1, { secret: config.sessionSecret, scope, now: now() });
    if (result.allowed) return null;
    return response(adminAuthPage({ stage: "limited" }), 429, {
      "Retry-After": String(adminAuthenticationRetryAfterSeconds(result, now())),
      "X-RateLimit-Remaining": "0",
    });
  }
  const clear = (scope) => clearAdminAuthenticationAttempts(database.d1, { secret: config.sessionSecret, scope });

  async function handle(request, url) {
    try {
      if (!config.configured) return unavailable();
      if (!["GET", "HEAD", "POST"].includes(request.method)) return response("Method Not Allowed", 405, { Allow: "GET, HEAD, POST" });
      let row = await session(request);
      const route = url.pathname.replace(/\/$/, "");
      if (request.method !== "POST") {
        if (route === "/admin-logout") return response("Method Not Allowed", 405, { Allow: "POST" });
        if (route === "/admin-security") {
          if (row?.kind !== "full") return redirect("/admin-login/");
          return response(adminAuthPage({ stage: "security", csrf: row.csrf }));
        }
        if (row?.kind === "full") return redirect("/admin-termine/");
        return page(row);
      }
      if (!validWriteOrigin(request)) return response("Forbidden", 403);
      if ((request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return response("Unsupported Media Type", 415);
      const text = await request.text();
      if (Buffer.byteLength(text) > 8192) return response("Payload Too Large", 413);
      const form = new URLSearchParams(text);
      for (const name of new Set(form.keys())) if (form.getAll(name).length !== 1) return response("Bad Request", 400);
      const action = form.get("action") || "password";

      if (route === "/admin-login" && action === "password") {
        const limited = await reserve("account");
        if (limited) return limited;
        const usernameValid = safeEqual(form.get("username") || "", config.username);
        const passwordValid = safeEqual(form.get("password") || "", config.password);
        if (!usernameValid || !passwordValid) return page(null, "Benutzername oder Passwort ist nicht korrekt.", 401);
        const existing = await account();
        if (!existing && !config.setupToken) return unavailable();
        if (existing) decrypt(existing.secret_cipher, "totp"); // A wrong encryption key must fail closed, never restart enrollment.
        const issued = await transaction(async (tx) => {
          if (row) await tx.execute({ sql: "DELETE FROM admin_login_sessions WHERE token_hash = ?", args: [row.token_hash] });
          // Bound outstanding password-proven challenges without affecting full sessions.
          await tx.execute({ sql: "DELETE FROM admin_login_sessions WHERE account_id = ? AND kind IN ('verify', 'setup-authorize')", args: [config.accountId] });
          return newSession(tx, existing ? "verify" : "setup-authorize");
        });
        await clear("account"); // Never clears the independently persisted second-factor budget.
        return redirect("/admin-login/", issued);
      }

      if (!row || !safeEqual(form.get("csrf") || "", row.csrf)) return response("Forbidden", 403);
      if (route === "/admin-logout" || (route === "/admin-security" && action === "logout-all")) {
        if (route === "/admin-security" && row.kind !== "full") return response("Forbidden", 403);
        await client.execute({
          sql: route === "/admin-security" ? "DELETE FROM admin_login_sessions WHERE account_id = ?" : "DELETE FROM admin_login_sessions WHERE token_hash = ?",
          args: [route === "/admin-security" ? config.accountId : row.token_hash],
        });
        return redirect("/admin-login/", { token: "", maxAge: 0 });
      }
      if (route !== "/admin-login") return response("Bad Request", 400);

      if (row.kind === "backup" && action === "acknowledge") {
        if (form.get("saved") !== "yes") return page(row, "Bitte sichern Sie zuerst Ihre Wiederherstellungscodes.", 400);
        const issued = await transaction(async (tx) => {
          const fresh = await session(request, tx);
          if (fresh?.kind !== "backup") return null;
          return replaceSession(tx, fresh, "full");
        });
        return issued ? redirect("/admin-termine/", issued) : response("Forbidden", 403);
      }

      if (!(["setup-authorize", "setup", "replace", "verify"].includes(row.kind))) return response("Bad Request", 400);
      const limited = await reserve("second-factor");
      if (limited) return limited;

      const result = await transaction(async (tx) => {
        row = await session(request, tx);
        if (!row || !safeEqual(form.get("csrf") || "", row.csrf)) return null;
        if (row.kind === "setup-authorize" && action === "authorize-setup") {
          if (!config.setupToken || !safeEqual(form.get("setup_token") || "", config.setupToken) || await account(tx)) return null;
          return replaceSession(tx, row, "setup", { secret: new Secret({ size: 20 }).base32 });
        }
        if (["setup", "replace"].includes(row.kind) && action === "confirm-setup") {
          const payload = decrypt(row.payload_cipher, row.token_hash);
          const counter = validCounter(payload.secret, form.get("code") || "");
          if (counter === null) return null;
          const existing = await account(tx);
          if ((row.kind === "setup" && existing) || (row.kind === "replace" && !existing)) return null;
          const codes = Array.from({ length: 10 }, () => randomBytes(12).toString("hex").toUpperCase().match(/.{4}/g).join("-"));
          const args = [encrypt(payload.secret, "totp"), counter, JSON.stringify(codes.map(recoveryHash)), now(), config.accountId];
          if (existing) {
            await tx.execute({ sql: "UPDATE admin_mfa_accounts SET secret_cipher = ?, last_counter = ?, recovery_hashes = ?, created_at = ? WHERE account_id = ?", args });
          } else {
            await tx.execute({ sql: "INSERT INTO admin_mfa_accounts (secret_cipher, last_counter, recovery_hashes, created_at, account_id) VALUES (?, ?, ?, ?, ?)", args });
          }
          await tx.execute({ sql: "DELETE FROM admin_login_sessions WHERE account_id = ? AND token_hash != ?", args: [config.accountId, row.token_hash] });
          return replaceSession(tx, row, "backup", { codes });
        }
        if (row.kind === "verify" && ["verify", "recover"].includes(action)) {
          const existing = await account(tx);
          if (!existing) return null;
          if (action === "recover") {
            const normalized = String(form.get("recovery_code") || "").replace(/[-\s]/g, "").toUpperCase();
            if (!/^[A-F0-9]{24}$/.test(normalized)) return null;
            const hashes = JSON.parse(existing.recovery_hashes);
            const digest = recoveryHash(normalized);
            const index = hashes.findIndex((value) => safeEqual(value, digest));
            if (index < 0) return null;
            hashes.splice(index, 1);
            await tx.execute({ sql: "UPDATE admin_mfa_accounts SET recovery_hashes = ? WHERE account_id = ?", args: [JSON.stringify(hashes), config.accountId] });
            await tx.execute({ sql: "DELETE FROM admin_login_sessions WHERE account_id = ? AND token_hash != ?", args: [config.accountId, row.token_hash] });
            return replaceSession(tx, row, "replace", { secret: new Secret({ size: 20 }).base32 });
          }
          const secret = decrypt(existing.secret_cipher, "totp");
          const counter = validCounter(secret, form.get("code") || "", Number(existing.last_counter));
          if (counter === null) return null;
          const consumed = await tx.execute({ sql: "UPDATE admin_mfa_accounts SET last_counter = ? WHERE account_id = ? AND last_counter < ?", args: [counter, config.accountId, counter] });
          if (Number(consumed.rowsAffected) !== 1) return null;
          return replaceSession(tx, row, "full");
        }
        return null;
      });
      if (!result) return page(await session(request), "Der Code ist ungültig, bereits verwendet oder abgelaufen. Bitte versuchen Sie den nächsten Code.", 401);
      if (["full", "backup", "replace"].includes(result.row.kind)) await clear("second-factor");
      return redirect(result.row.kind === "full" ? "/admin-termine/" : "/admin-login/", result);
    } catch {
      // Never log credentials, tokens, OTP secrets, request bodies or database bindings.
      console.error("Admin authentication operation unavailable");
      return unavailable();
    }
  }
  async function authorize(request) {
    if (!config.configured) return { configured: false, authorized: false };
    try {
      const row = await session(request, client, true);
      return { configured: true, authorized: row?.kind === "full", method: "session" };
    } catch {
      console.error("Admin session validation unavailable");
      return { configured: true, authorized: false, unavailable: true };
    }
  }
  return {
    async handle(request, url) {
      const result = await handle(request, url);
      return request.method === "HEAD" ? new Response(null, { status: result.status, headers: result.headers }) : result;
    },
    authorize, validWriteOrigin, origin: config.origin,
  };
}
