const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const MAX_BODY_BYTES = 64 * 1024;
const MIN_SUBMIT_TIME_MS = 3500;
const MAX_MESSAGE_LENGTH = 3600;
const MAX_TEXT_LENGTH = 220;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function htmlMessage(title, message, status = 200) {
  return new Response(`<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Artbild-Fotografie</title>
  </head>
  <body>
    <main style="max-width:42rem;margin:10vh auto;padding:2rem;font-family:Georgia,serif;line-height:1.6">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/kontakt/">Zurück zum Kontaktformular</a></p>
    </main>
  </body>
</html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function wantsJson(request) {
  const accept = request.headers.get("accept") || "";
  const requestedWith = request.headers.get("x-requested-with") || "";
  return accept.includes("application/json") || requestedWith === "fetch";
}

function reply(request, body, status = 200) {
  if (wantsJson(request)) return json(body, status);
  return htmlMessage(body.title || "Kontaktformular", body.message || "Vielen Dank.", status);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validDateValue(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function countUrls(value) {
  return (String(value).match(/https?:\/\/|www\./gi) || []).length;
}

async function sha256(value) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTurnstile(token, secret, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  return Boolean(result.success);
}

async function parsePayload(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return {
      error: "Die Anfrage ist zu groß. Bitte kürzt die Nachricht etwas.",
      status: 413,
    };
  }

  const form = await request.formData();
  return {
    payload: {
      name: cleanText(form.get("name")),
      email: normalizeEmail(form.get("email")),
      phone: cleanText(form.get("phone"), 80),
      requestType: cleanText(form.get("request_type"), 80),
      eventDate: cleanText(form.get("event_date"), 20),
      location: cleanText(form.get("location")),
      coverage: cleanText(form.get("coverage"), 80),
      guestCount: cleanText(form.get("guest_count"), 20),
      referral: cleanText(form.get("referral")),
      message: String(form.get("message") || "").trim().slice(0, MAX_MESSAGE_LENGTH + 1),
      privacy: form.get("privacy") === "yes",
      website: cleanText(form.get("website"), 500),
      loadedAt: Number(form.get("form_loaded_at") || "0"),
      jsEnabled: form.get("js_enabled") === "1",
      sourcePath: cleanText(form.get("source_path"), 180),
      turnstileToken: cleanText(form.get("cf-turnstile-response"), 4096),
    },
  };
}

function validate(payload) {
  if (payload.website) return { spam: true };
  if (!payload.name || payload.name.length < 2) return { error: "Bitte nennt euren Namen." };
  if (!validEmail(payload.email)) return { error: "Bitte tragt eine gültige E-Mail-Adresse ein." };
  if (!payload.requestType) return { error: "Bitte wählt aus, worum es geht." };
  if (!validDateValue(payload.eventDate)) return { error: "Bitte verwendet ein gültiges Datum." };
  if (!payload.message || payload.message.length < 20) {
    return { error: "Bitte schreibt kurz, worum es geht. 20 Zeichen reichen schon." };
  }
  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    return { error: "Die Nachricht ist zu lang. Bitte kürzt sie etwas." };
  }
  if (!payload.privacy) return { error: "Bitte bestätigt den Datenschutz-Hinweis." };
  if (countUrls(payload.message) > 3 || countUrls(payload.referral) > 2) {
    return { error: "Die Nachricht enthält ungewöhnlich viele Links." };
  }
  if (payload.jsEnabled && payload.loadedAt && Date.now() - payload.loadedAt < MIN_SUBMIT_TIME_MS) {
    return { spam: true };
  }

  return {};
}

async function recentSubmissionCount(db, ipHash, email) {
  if (!db) return 0;
  const row = await db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM contact_requests
      WHERE created_at >= datetime('now', '-15 minutes')
        AND (ip_hash = ? OR email = ?)
    `)
    .bind(ipHash, email)
    .first();
  return Number(row?.count || 0);
}

async function storeInD1(db, payload, ipHash, userAgent) {
  const id = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO contact_requests (
        id,
        name,
        email,
        phone,
        request_type,
        event_date,
        location,
        coverage,
        guest_count,
        referral,
        message,
        source_path,
        user_agent,
        ip_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      payload.name,
      payload.email,
      payload.phone,
      payload.requestType,
      payload.eventDate,
      payload.location,
      payload.coverage,
      payload.guestCount,
      payload.referral,
      payload.message,
      payload.sourcePath,
      userAgent,
      ipHash,
    )
    .run();
  return id;
}

async function forwardToWebhook(url, payload, requestId) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "artbild-contact-form/1.0",
    },
    body: JSON.stringify({
      requestId,
      submittedAt: new Date().toISOString(),
      ...payload,
      website: undefined,
      loadedAt: undefined,
      jsEnabled: undefined,
      turnstileToken: undefined,
    }),
  });
  return response.ok;
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      Allow: "POST, OPTIONS",
    },
  });
}

export function onRequestGet({ request }) {
  return reply(request, {
    title: "Kontaktformular",
    message: "Bitte nutzt das Formular auf der Kontaktseite.",
  }, 405);
}

export async function onRequestPost({ request, env }) {
  let parsed;
  try {
    parsed = await parsePayload(request);
  } catch {
    return reply(request, {
      title: "Kontaktformular",
      message: "Die Anfrage konnte nicht gelesen werden.",
    }, 400);
  }

  if (parsed.error) {
    return reply(request, {
      title: "Kontaktformular",
      message: parsed.error,
    }, parsed.status || 400);
  }

  const { payload } = parsed;
  const validation = validate(payload);
  if (validation.spam) {
    return reply(request, {
      ok: true,
      title: "Vielen Dank",
      message: "Vielen Dank. Die Anfrage wurde entgegengenommen.",
    });
  }
  if (validation.error) {
    return reply(request, {
      ok: false,
      title: "Bitte prüfen",
      message: validation.error,
    }, 422);
  }

  if ((env.CONTACT_REQUIRE_TURNSTILE === "true" || payload.turnstileToken) && env.TURNSTILE_SECRET_KEY) {
    const turnstileOk = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET_KEY, request);
    if (!turnstileOk) {
      return reply(request, {
        ok: false,
        title: "Bitte erneut versuchen",
        message: "Die Spam-Prüfung konnte nicht bestätigt werden.",
      }, 422);
    }
  }

  const db = env.DB || env.CONTACT_DB;
  const userAgent = cleanText(request.headers.get("user-agent"), 500);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
  const ipHash = await sha256(`${env.CONTACT_HASH_SALT || "artbild"}:${ip}`);

  if (db) {
    const recentCount = await recentSubmissionCount(db, ipHash, payload.email);
    if (recentCount >= 3) {
      return reply(request, {
        ok: false,
        title: "Zu viele Anfragen",
        message: "Bitte wartet einen Moment, bevor ihr erneut sendet.",
      }, 429);
    }
  }

  const hasWebhook = typeof env.CONTACT_WEBHOOK_URL === "string" && env.CONTACT_WEBHOOK_URL.startsWith("https://");
  if (!db && !hasWebhook) {
    return reply(request, {
      ok: false,
      title: "Kontaktformular noch nicht aktiv",
      message: "Das Kontaktformular ist technisch vorbereitet, aber noch nicht mit D1 oder einem Webhook verbunden. Bitte schreibt direkt an info@artbild-fotografie.de.",
    }, 503);
  }

  try {
    const requestId = db ? await storeInD1(db, payload, ipHash, userAgent) : crypto.randomUUID();
    const webhookOk = hasWebhook ? await forwardToWebhook(env.CONTACT_WEBHOOK_URL, payload, requestId) : true;
    if (!webhookOk) throw new Error("webhook_failed");

    return reply(request, {
      ok: true,
      title: "Danke für eure Anfrage",
      message: "Vielen Dank. Eure Anfrage ist angekommen. Ich melde mich persönlich bei euch.",
      requestId,
    });
  } catch {
    return reply(request, {
      ok: false,
      title: "Kontaktformular nicht erreichbar",
      message: "Die Anfrage konnte gerade nicht gespeichert werden. Bitte schreibt direkt an info@artbild-fotografie.de.",
    }, 503);
  }
}
