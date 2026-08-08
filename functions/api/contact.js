const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MIN_SUBMIT_TIME_MS = 3500;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_TEXT_LENGTH = 220;
const MAX_TFP_IMAGES = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_REQUEST_TYPES = new Set([
  "hochzeit",
  "standesamtliche-trauung",
  "portraitshooting",
  "tfp",
]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REQUEST_TYPE_LABELS = {
  hochzeit: "Hochzeit",
  "standesamtliche-trauung": "Standesamtliche Trauung",
  portraitshooting: "Portraitshooting",
  tfp: "TFP",
};
const CONTACT_SUBJECT = "Neue Anfrage über das Kontaktformular";

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

function cleanHeaderText(value, maxLength = MAX_TEXT_LENGTH) {
  return cleanText(value, maxLength).replace(/[\r\n]+/g, " ");
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

function hasLineBreak(value) {
  return /[\r\n]/.test(String(value || ""));
}

function currentYear() {
  return Number(new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
  }).format(new Date()));
}

function containsUnsafeCharacters(value) {
  return /[<>{}\[\]`]/.test(String(value || ""));
}

function containsCodePattern(value) {
  const text = String(value || "").toLowerCase();
  return /<\s*\/?\s*[a-z]|javascript:|data:text\/html|on[a-z]+\s*=|%3c|%3e|\{\{|\}\}|\$\{/.test(text);
}

function safeFileName(value) {
  return String(value || "bild")
    .split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function configuredSmtp(env) {
  const user = cleanHeaderText(env.STRATO_SMTP_USER, 320);
  const pass = String(env.STRATO_SMTP_PASS || "");
  const from = cleanHeaderText(env.CONTACT_FROM || env.STRATO_SMTP_USER, 320);
  const to = cleanHeaderText(env.CONTACT_TO, 320);

  if (!user || !pass || !from || !to) return null;
  if (
    !validEmail(user.toLowerCase())
    || !validEmail(from.toLowerCase())
    || !validEmail(to.toLowerCase())
  ) {
    return null;
  }

  return { user, pass, from, to };
}

function formatRequestType(value) {
  return REQUEST_TYPE_LABELS[value] || value || "Nicht angegeben";
}

function buildMailText(payload, request, requestId) {
  const submittedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const pagePath = payload.sourcePath || "/kontakt/";

  return [
    "Neue Anfrage über das Kontaktformular",
    "",
    `Anfrage-ID: ${requestId}`,
    `Zeitpunkt: ${submittedAt}`,
    `Seite: ${pagePath}`,
    "",
    `Art der Anfrage: ${formatRequestType(payload.requestType)}`,
    `Name: ${payload.name}`,
    `E-Mail: ${payload.email}`,
    `Ort/Location: ${payload.location}`,
    `Wunschdatum: ${payload.eventDate || "offen"}`,
    `TFP-Bilder: ${payload.attachments.length ? payload.attachments.map((attachment) => attachment.filename).join(", ") : "keine"}`,
    "",
    "Nachricht:",
    payload.message || "Keine zusätzliche Nachricht.",
  ].join("\n");
}

async function sendSmtpMail(env, payload, request, requestId) {
  const smtp = configuredSmtp(env);
  if (!smtp) {
    throw new Error("smtp_not_configured");
  }

  const message = {
    from: {
      name: "Artbild Kontaktformular",
      email: smtp.from,
    },
    to: {
      name: "Artbild-Fotografie",
      email: smtp.to,
    },
    reply: {
      name: cleanHeaderText(payload.name, 120),
      email: payload.email,
    },
    subject: CONTACT_SUBJECT,
    text: buildMailText(payload, request, requestId),
    attachments: payload.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.base64,
      mimeType: attachment.contentType,
    })),
  };

  if (typeof env.CONTACT_MAILER !== "function") {
    throw new Error("smtp_transport_not_configured");
  }
  await env.CONTACT_MAILER(message);
}

async function readImageAttachment(file) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      error: `Das Bild "${safeFileName(file.name)}" ist zu groß. Bitte maximal 2 MB pro Bild hochladen.`,
    };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      error: `Das Bild "${safeFileName(file.name)}" hat kein erlaubtes Format. Bitte JPG, PNG oder WebP verwenden.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  const isWebp =
    bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;

  const signatureMatches =
    (file.type === "image/jpeg" && isJpeg)
    || (file.type === "image/png" && isPng)
    || (file.type === "image/webp" && isWebp);

  if (!signatureMatches) {
    return {
      error: `Das Bild "${safeFileName(file.name)}" konnte nicht als echte Bilddatei erkannt werden.`,
    };
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return {
    attachment: {
      filename: safeFileName(file.name),
      contentType: file.type,
      size: file.size,
      base64: btoa(binary),
    },
  };
}

async function collectImageAttachments(form) {
  const files = form
    .getAll("tfp_images")
    .filter((file) => file instanceof File && file.size > 0);

  if (files.length > MAX_TFP_IMAGES) {
    return {
      error: `Bitte maximal ${MAX_TFP_IMAGES} Bilder hochladen.`,
    };
  }

  const attachments = [];
  for (const file of files) {
    const result = await readImageAttachment(file);
    if (result?.error) return result;
    if (result?.attachment) attachments.push(result.attachment);
  }

  return { attachments };
}

async function sha256(value) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function parsePayload(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return {
      error: "Die Anfrage ist zu groß. Bitte maximal drei Bilder mit je 2 MB hochladen.",
      status: 413,
    };
  }

  const form = await request.formData();
  const attachmentResult = await collectImageAttachments(form);
  if (attachmentResult.error) {
    return {
      error: attachmentResult.error,
      status: 422,
    };
  }

  return {
    payload: {
      name: cleanText(form.get("name")),
      email: normalizeEmail(form.get("email")),
      requestType: cleanText(form.get("request_type"), 80),
      eventDate: cleanText(form.get("event_date"), 20),
      location: cleanText(form.get("location")),
      message: String(form.get("message") || "").trim().slice(0, MAX_MESSAGE_LENGTH + 1),
      securityYear: cleanText(form.get("security_year"), 4),
      privacy: form.get("privacy") === "yes",
      website: cleanText(form.get("website"), 500),
      loadedAt: Number(form.get("form_loaded_at") || "0"),
      jsEnabled: form.get("js_enabled") === "1",
      sourcePath: cleanText(form.get("source_path"), 180),
      attachments: attachmentResult.attachments || [],
    },
  };
}

function validate(payload) {
  if (payload.website) return { spam: true };
  if (!payload.name || payload.name.length < 2) return { error: "Bitte nennt euren Namen." };
  if (!validEmail(payload.email)) return { error: "Bitte tragt eine gültige E-Mail-Adresse ein." };
  if (hasLineBreak(payload.name) || hasLineBreak(payload.email)) {
    return { error: "Bitte prüft Name und E-Mail-Adresse." };
  }
  if (!ALLOWED_REQUEST_TYPES.has(payload.requestType)) return { error: "Bitte wählt aus, worum es geht." };
  if (!payload.location || payload.location.length < 2) return { error: "Bitte nennt den Ort oder die Stadt." };
  if (!validDateValue(payload.eventDate)) return { error: "Bitte verwendet ein gültiges Datum." };
  if (payload.requestType !== "tfp" && !payload.eventDate) {
    return { error: "Bitte tragt euer Wunschdatum ein, damit ich die Verfügbarkeit prüfen kann." };
  }
  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    return { error: "Die Nachricht ist zu lang. Bitte kürzt sie etwas." };
  }
  if (String(currentYear()) !== payload.securityYear) {
    return { error: `Bitte beantwortet die Sicherheitsfrage mit dem aktuellen Jahr ${currentYear()}.` };
  }
  if (!payload.privacy) return { error: "Bitte bestätigt den Datenschutz-Hinweis." };
  if (countUrls(payload.message) > 1) {
    return { error: "Die Nachricht enthält ungewöhnlich viele Links." };
  }
  const textValues = [payload.name, payload.location, payload.message];
  if (textValues.some((value) => containsUnsafeCharacters(value) || containsCodePattern(value))) {
    return { error: "Bitte entfernt Sonderzeichen oder Code-Fragmente aus der Anfrage." };
  }
  if (payload.requestType !== "tfp" && payload.attachments.length > 0) {
    return { error: "Bilder können nur bei TFP-Anfragen hochgeladen werden." };
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

async function pruneStoredContactData(db) {
  if (!db) return;
  await db
    .prepare(`
      UPDATE contact_requests
      SET ip_hash = NULL,
          user_agent = NULL,
          security_year = NULL
      WHERE created_at < datetime('now', '-15 minutes')
        AND (ip_hash IS NOT NULL OR user_agent IS NOT NULL OR security_year IS NOT NULL)
    `)
    .run();
  await db
    .prepare(`
      DELETE FROM contact_requests
      WHERE created_at < datetime('now', '-30 days')
    `)
    .run();
}

async function updateStoredRequestStatus(db, requestId, status) {
  if (!db || !requestId) return;
  await db
    .prepare(`
      UPDATE contact_requests
      SET status = ?
      WHERE id = ?
    `)
    .bind(status, requestId)
    .run();
}

async function storeInD1(db, payload, ipHash) {
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
        security_year,
        attachment_count,
        attachment_names,
        source_path,
        user_agent,
        ip_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      payload.name,
      payload.email,
      "",
      payload.requestType,
      payload.eventDate,
      payload.location,
      "",
      "",
      "",
      payload.message,
      null,
      String(payload.attachments.length),
      payload.attachments.map((attachment) => attachment.filename).join(", "),
      payload.sourcePath,
      null,
      ipHash,
    )
    .run();
  return id;
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

  const db = env.DB || env.CONTACT_DB;
  const hashSalt = String(env.CONTACT_HASH_SALT || "").trim();
  if (hashSalt.length < 32) {
    return reply(request, {
      ok: false,
      title: "Kontaktformular noch nicht aktiv",
      message: "Das Kontaktformular ist technisch noch nicht vollständig konfiguriert. Bitte schreibt direkt an info@artbild-fotografie.de.",
    }, 503);
  }
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const ipHash = await sha256(`${hashSalt}:${ip}`);
  const smtp = configuredSmtp(env);

  if (db) {
    await pruneStoredContactData(db);
    const recentCount = await recentSubmissionCount(db, ipHash, payload.email);
    if (recentCount >= 3) {
      return reply(request, {
        ok: false,
        title: "Zu viele Anfragen",
        message: "Bitte wartet einen Moment, bevor ihr erneut sendet.",
      }, 429);
    }
  }

  if (!smtp || typeof env.CONTACT_MAILER !== "function") {
    return reply(request, {
      ok: false,
      title: "Kontaktformular noch nicht aktiv",
      message: "Das Kontaktformular ist technisch vorbereitet, aber noch nicht mit dem Mailversand verbunden. Bitte schreibt direkt an info@artbild-fotografie.de.",
    }, 503);
  }

  let requestId = "";
  try {
    requestId = db ? await storeInD1(db, payload, ipHash) : crypto.randomUUID();
    await sendSmtpMail(env, payload, request, requestId);
    try {
      await updateStoredRequestStatus(db, requestId, "delivered");
    } catch (error) {
      console.error("Contact delivery status update failed", error);
    }

    return reply(request, {
      ok: true,
      title: "Danke für eure Anfrage",
      message: "Vielen Dank. Eure Anfrage ist angekommen. Ich melde mich persönlich bei euch.",
      requestId,
    });
  } catch {
    try {
      await updateStoredRequestStatus(db, requestId, "delivery_failed");
    } catch {
      // The delivery error remains the primary failure reported to the visitor.
    }
    return reply(request, {
      ok: false,
      title: "Kontaktformular nicht erreichbar",
      message: "Die Anfrage konnte gerade nicht gespeichert werden. Bitte schreibt direkt an info@artbild-fotografie.de.",
    }, 503);
  }
}
