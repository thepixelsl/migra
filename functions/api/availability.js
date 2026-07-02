const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const MAX_MONTHS_AHEAD = 24;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function dateValueFromBerlinNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function maxDateValue() {
  const [year, month, day] = dateValueFromBerlinNow().split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const maximum = new Date(Date.UTC(year, month - 1 + MAX_MONTHS_AHEAD, 1));
  const lastDay = new Date(Date.UTC(maximum.getUTCFullYear(), maximum.getUTCMonth() + 1, 0)).getUTCDate();
  maximum.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return [
    maximum.getUTCFullYear(),
    String(maximum.getUTCMonth() + 1).padStart(2, "0"),
    String(maximum.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function dateLabel(value) {
  const date = parseDateValue(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function invalidDate(message) {
  return json({
    status: "invalid_date",
    message,
  }, 400);
}

function fallback(date) {
  return json({
    status: "temporarily_disabled",
    date_label: dateLabel(date),
    message: "Die automatische Terminprüfung ist gerade nicht verfügbar. Bitte sendet mir euren Wunschtermin über das Kontaktformular - ich prüfe ihn persönlich.",
    action_label: "Termin persönlich anfragen",
    action_href: `/kontakt/?termin=${encodeURIComponent(date)}`,
  }, 503);
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

export function onRequestGet() {
  return json({
    status: "method_not_allowed",
    message: "Bitte nutze das Kontaktmenü, um einen Termin zu prüfen.",
  }, 405);
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return invalidDate("Bitte sendet ein gültiges Datum.");
  }

  if (payload?.website) {
    return fallback(payload?.date || dateValueFromBerlinNow());
  }

  const date = typeof payload?.date === "string" ? payload.date : "";
  if (!parseDateValue(date)) return invalidDate("Bitte wählt ein gültiges Datum aus.");
  if (date < dateValueFromBerlinNow()) return invalidDate("Bitte wählt ein heutiges oder zukünftiges Datum aus.");
  if (date > maxDateValue()) return invalidDate(`Bitte wählt ein Datum innerhalb der nächsten ${MAX_MONTHS_AHEAD} Monate aus.`);

  const db = env.DB || env.AVAILABILITY_DB;
  if (!db) return fallback(date);

  try {
    const row = await db
      .prepare("SELECT status, note FROM availability_dates WHERE date = ? LIMIT 1")
      .bind(date)
      .first();

    if (row?.status === "unavailable") {
      return json({
        status: "unavailable",
        date_label: dateLabel(date),
        message: row.note || `Am ${dateLabel(date)} bin ich leider nicht mehr verfügbar.`,
        action_label: "Persönlich nachfragen",
        action_href: `/kontakt/?termin=${encodeURIComponent(date)}`,
      });
    }

    return json({
      status: "available",
      date_label: dateLabel(date),
      message: row?.note || `Nach aktuellem Kalenderstand ist der ${dateLabel(date)} noch verfügbar. Verbindlich wird der Termin erst nach meiner persönlichen Bestätigung und erfolgreicher Buchung.`,
      action_label: "Jetzt unverbindlich anfragen",
      action_href: `/kontakt/?termin=${encodeURIComponent(date)}`,
    });
  } catch {
    return json({
      status: "technical_error",
      date_label: dateLabel(date),
      message: "Die automatische Terminprüfung ist gerade nicht zuverlässig möglich. Bitte sendet mir euren Wunschtermin über das Kontaktformular - ich prüfe ihn persönlich.",
      action_label: "Termin persönlich anfragen",
      action_href: `/kontakt/?termin=${encodeURIComponent(date)}`,
    }, 503);
  }
}
