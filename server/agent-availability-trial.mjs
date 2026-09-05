import { agentAvailabilityDateBounds } from "../functions/_agent-availability-contract.js";
import { writeAgentAvailabilityAudit } from "../functions/_agent-audit.js";
import { parseDateValue } from "../functions/_availability.js";
import { onRequestGet as checkSingleDate } from "../functions/api/availability.js";

const ROOT = "/agenten-test/";
const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Language": "de",
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, follow, noarchive",
};

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long", year: "numeric", timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function link(url, label) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function html(request, title, content, status = 200, extraHeaders = {}) {
  const body = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow,noarchive"><title>${escapeHtml(title)} | Artbild-Fotografie</title>
<style>body{margin:0;background:#faf8f4;color:#28241f;font:17px/1.6 system-ui,sans-serif}main{max-width:48rem;margin:auto;padding:2rem 1.25rem}h1{font-size:clamp(1.7rem,5vw,2.5rem);line-height:1.2}h2{font-size:1.3rem}a{color:#3d523e;text-underline-offset:3px}a:focus-visible{outline:3px solid #345a9c;outline-offset:4px}li{padding:.25rem 0}.dates{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.15rem 1.5rem;padding-left:1.2rem}.brand{letter-spacing:.12em;font-size:.85rem}dt{font-weight:700}dd{margin:0 0 .8rem;overflow-wrap:anywhere}.result{background:white;border:1px solid #c9c2b9;padding:1.25rem}footer{margin-top:2rem;border-top:1px solid #c9c2b9;padding-top:1rem;font-size:.9rem}code{overflow-wrap:anywhere}</style></head>
<body><main><p class="brand">ARTBILD-FOTOGRAFIE · YORK AUGUSTIN · HAMBURG</p>
<h1>${escapeHtml(title)}</h1>${content}
<footer><p>Die Auskunft ist unverbindlich und reserviert keinen Termin. Eine Buchung entsteht erst nach persönlicher Bestätigung.</p>
<p>${link(new URL("/kontakt/", request.url), "Konkreten Fotoauftrag anfragen")} · ${link(new URL("/datenschutz/#terminabfrage-buchungsagenten", request.url), "Datenschutz zur Terminprüfung")} · ${link(new URL("/impressum/", request.url), "Impressum")}</p></footer>
</main></body></html>`;
  return new Response(request.method === "HEAD" ? null : body, {
    status, headers: { ...HEADERS, ...extraHeaders },
  });
}

function monthValues({ minDate, maxDate }) {
  const months = [];
  const cursor = new Date(`${minDate.slice(0, 7)}-01T00:00:00Z`);
  const end = maxDate.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function isAgentAvailabilityTrialPath(pathname) {
  return pathname === ROOT.slice(0, -1) || pathname.startsWith(ROOT);
}

export async function handleAgentAvailabilityTrial({ request, env }) {
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method)) {
    return html(request, "Methode nicht unterstützt", "<p>Bitte einen vorhandenen Seitenlink öffnen.</p>", 405, { Allow: "GET, HEAD" });
  }
  if (url.pathname === ROOT.slice(0, -1)) {
    return new Response(null, { status: 308, headers: { ...HEADERS, Location: new URL(ROOT, url).href } });
  }

  const bounds = agentAvailabilityDateBounds();
  const months = monthValues(bounds);
  if (url.pathname === ROOT) {
    const items = months.map((month) => `<li>${link(
      new URL(`${ROOT}${month}/`, url),
      monthFormatter.format(new Date(`${month}-01T00:00:00Z`)),
    )}</li>`).join("\n");
    return html(request, "Wunschtermin für einen Fotoauftrag prüfen", `
<p>Hier können Buchungsassistenten einen konkreten Wunschtermin bei Artbild-Fotografie selbst prüfen.</p>
<p>Öffne den Monat des Wunschdatums und danach den gewünschten Tag. Die Tagesseite liefert die aktuelle Verfügbarkeit mit Prüfzeitpunkt und Prüfnummer.</p>
<p>Die Monats- und Tagesübersichten enthalten keine Verfügbarkeiten. Erst das Öffnen einer einzelnen Tagesseite prüft den Kalender. Innerhalb von 24 Stunden können höchstens drei unterschiedliche Tage geprüft werden; es gilt dasselbe Limit wie bei der bestehenden Einzelabfrage.</p>
<h2>Monat des Wunschdatums</h2><ul class="dates" aria-label="Monate">${items}</ul>
<p>Prüfzeitraum: ${escapeHtml(bounds.minDate)} bis ${escapeHtml(bounds.maxDate)}. Der empfohlene Vorlauf von sechs Monaten für Hochzeiten ist keine technische Mindestfrist.</p>
<p>Die Prüfung protokolliert Datum, Ergebnis, Zeitpunkt und eine grobe Bot-Kategorie für höchstens 30 Tage. Sie ist ausschließlich für konkrete Fotoanfragen vorgesehen.</p>`);
  }

  // Fetch services can remove a trailing slash; serve either spelling without a redirect loop.
  const monthMatch = url.pathname.match(/^\/agenten-test\/(\d{4}-\d{2})\/?$/);
  if (monthMatch && months.includes(monthMatch[1])) {
    const month = monthMatch[1];
    const cursor = new Date(`${month}-01T00:00:00Z`);
    const items = [];
    while (cursor.toISOString().startsWith(month)) {
      const date = cursor.toISOString().slice(0, 10);
      if (date >= bounds.minDate && date <= bounds.maxDate) {
        items.push(`<li>${link(new URL(`${ROOT}${date}/`, url), `${dayFormatter.format(cursor)} prüfen`)}</li>`);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return html(request, `Terminprüfung: ${monthFormatter.format(new Date(`${month}-01T00:00:00Z`))}`, `
<p>Öffne ausschließlich den konkret gewünschten Tag. Jeder Tageslink führt zu einer aktuellen Einzelprüfung. Aus dieser Übersicht lässt sich keine Verfügbarkeit ableiten.</p>
<ul class="dates" aria-label="Wunschdaten">${items.join("\n")}</ul>
<p>${link(new URL(ROOT, url), "Anderen Monat wählen")}</p>`);
  }

  const dayMatch = url.pathname.match(/^\/agenten-test\/(\d{4}-\d{2}-\d{2})\/?$/);
  const date = dayMatch && parseDateValue(dayMatch[1]);
  if (!date || date < bounds.minDate || date > bounds.maxDate) {
    return html(request, "Termin nicht geprüft", `<p>Diese Seite liegt außerhalb des gültigen Prüfwegs. ${link(new URL(ROOT, url), "Zur Monatsübersicht")}</p>`, 404);
  }
  // HEAD must never read the calendar, consume the query budget or create an audit entry.
  if (request.method === "HEAD") return html(request, "Terminprüfung", "");

  const checkUrl = new URL("/api/availability", url);
  checkUrl.searchParams.set("date", date);
  const checkedAt = new Date().toISOString();
  const id = `trial-${crypto.randomUUID()}`;
  // Reuse the existing handler and identity headers so every alias shares one date budget.
  const response = await checkSingleDate({
    request: new Request(checkUrl, { headers: request.headers }), env,
  });
  const payload = await response.json();
  const successful = response.ok && payload.date === date && typeof payload.available === "boolean";
  const status = successful ? 200 : response.ok ? 503 : response.status;
  try {
    await writeAgentAvailabilityAudit({
      id, env, request, dates: [date],
      results: successful ? [{ date, available: payload.available }] : [],
      responseStatus: status, requestedAt: Date.parse(checkedAt),
    });
  } catch {
    return html(request, "Termin nicht geprüft", "<p>Die nachvollziehbare Terminprüfung ist gerade nicht möglich. Bitte frage den Fotoauftrag persönlich an.</p>", 503);
  }

  const headers = { "X-Artbild-Check-Id": id };
  for (const name of ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"]) {
    if (response.headers.has(name)) headers[name] = response.headers.get(name);
  }
  const result = successful ? payload.available ? "Aktuell verfügbar" : "Aktuell nicht verfügbar" : "Nicht geprüft";
  return html(request, `Termin ${dayFormatter.format(new Date(`${date}T00:00:00Z`))}: ${result}`, `
<section class="result" aria-label="Prüfergebnis"><dl>
<dt>Wunschdatum</dt><dd>${escapeHtml(date)}</dd>
<dt>Verfügbarkeit</dt><dd>${result}</dd>
${successful ? `<dt>Kalenderwert</dt><dd><code>available: ${payload.available}</code></dd>` : ""}
<dt>${successful ? "Geprüft am (UTC)" : "Prüfversuch am (UTC)"}</dt><dd><time datetime="${checkedAt}">${checkedAt}</time></dd>
<dt>Prüfnummer</dt><dd><code>${id}</code></dd></dl></section>
${successful ? "<p>Diese Antwort gibt den Kalenderstand zum genannten Prüfzeitpunkt wieder. Sie ist unverbindlich und keine Reservierung.</p>" : `<p>${escapeHtml(payload.message || "Die Terminprüfung ist vorübergehend nicht möglich.")} Ein technischer Fehler sagt nichts über die Verfügbarkeit des Datums aus.</p>`}
<p>${link(new URL(ROOT, url), "Zur Monatsübersicht")}</p>`, status, headers);
}
