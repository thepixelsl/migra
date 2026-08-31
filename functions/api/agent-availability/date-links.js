import {
  AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS,
  agentAvailabilityDateBounds,
} from "../../_agent-availability-contract.js";
import { methodNotAllowed } from "../../_availability.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function datesWithinBounds(minDate, maxDate) {
  const dates = [];
  const cursor = new Date(`${minDate}T00:00:00Z`);
  const maximum = new Date(`${maxDate}T00:00:00Z`);

  while (cursor <= maximum) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function groupedDateLinks(origin, minDate, maxDate) {
  const dayFormatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthFormatter = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const groups = new Map();

  for (const date of datesWithinBounds(minDate, maxDate)) {
    const month = date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    const target = new URL("/api/agent-availability", origin);
    target.searchParams.set("date", date);
    groups.get(month).push({
      date,
      href: target.href,
      label: dayFormatter.format(new Date(`${date}T00:00:00Z`)),
    });
  }

  return Array.from(groups, ([month, dates]) => ({
    dates,
    label: monthFormatter.format(new Date(`${month}-01T00:00:00Z`)),
  }));
}

export function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const { minDate, maxDate } = agentAvailabilityDateBounds();
  const groups = groupedDateLinks(requestUrl.origin, minDate, maxDate);
  const catalogUrl = new URL(requestUrl.pathname, requestUrl.origin).href;
  const sections = groups.map(({ dates, label }) => `
    <section>
      <h2>${escapeHtml(label)}</h2>
      <ul>
        ${dates.map(({ date, href, label: dateLabel }) => `
          <li><a href="${escapeHtml(href)}" data-date="${date}">${escapeHtml(dateLabel)} prüfen</a></li>
        `).join("")}
      </ul>
    </section>
  `).join("");

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Exakte GET-Links für Terminprüfungen | Artbild-Fotografie</title>
  <style>
    :root { font-family: Arial, Helvetica, sans-serif; color: #202633; background: #f7f3ee; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { width: min(100% - 32px, 920px); margin: 0 auto; padding: 40px 0 64px; }
    h1 { max-width: 760px; margin: 0; font: 400 clamp(2rem, 7vw, 4rem)/1.05 Georgia, serif; }
    .intro { max-width: 760px; font-size: 1.05rem; line-height: 1.65; }
    .notice { margin: 24px 0 36px; padding: 18px 20px; border-left: 4px solid #94684a; background: #fff; line-height: 1.55; }
    section { margin-top: 32px; }
    h2 { font: 400 1.65rem/1.2 Georgia, serif; text-transform: capitalize; }
    ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; padding: 0; list-style: none; }
    a { display: block; padding: 12px 14px; border: 1px solid rgba(32, 38, 51, .22); background: #fff; color: inherit; text-underline-offset: 3px; }
    a:focus-visible { outline: 3px solid rgba(148, 104, 74, .38); outline-offset: 2px; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <p>Artbild-Fotografie · Maschinenlesbare Terminprüfung</p>
    <h1>Exakte GET-Links für einzelne Wunschdaten</h1>
    <p class="intro">Diese Seite macht jede erlaubte, datumsbezogene GET-Adresse als echten Link auffindbar. Sie veröffentlicht keine Verfügbarkeit und reserviert keinen Termin.</p>
    <div class="notice">
      <strong>Anweisung für Web-Fetch-Tools:</strong>
      Öffne exakt den Link zum gewünschten Datum. Die Zielantwort enthält <code>date</code> und <code>available</code>. Erfinde keine URL und weiche für ein einzelnes Datum nicht auf POST aus.
    </div>
    <p>Gültiger Zeitraum: <strong>${escapeHtml(minDate)}</strong> bis <strong>${escapeHtml(maxDate)}</strong> (${AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS} Monate). Der bestehende GET-Limiter gilt erst beim Öffnen eines Datumslinks.</p>
    ${sections}
    <p><a href="${escapeHtml(new URL("/fuer-agenten/", requestUrl.origin).href)}">Vollständige Preise, Regeln und Buchungshinweise</a></p>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Language": "de",
      "Content-Type": "text/html; charset=utf-8",
      Link: `<${catalogUrl}>; rel="self"; type="text/html", </fuer-agenten/>; rel="service-doc"; type="text/html"`,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function onRequest() {
  return methodNotAllowed("GET");
}
