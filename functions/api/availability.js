import {
  json,
  methodNotAllowed,
  parseDateValue,
  readBlockedDates,
} from "../_availability.js";

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "GET, OPTIONS",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const dates = url.searchParams.getAll("date");
  if (dates.length !== 1) {
    return json(
      {
        error: "invalid_date",
        message: "Bitte genau ein Datum im Format YYYY-MM-DD senden.",
      },
      400,
    );
  }

  const date = parseDateValue(dates[0]);
  if (!date) {
    return json(
      {
        error: "invalid_date",
        message: "Bitte ein gültiges Datum im Format YYYY-MM-DD senden.",
      },
      400,
    );
  }

  try {
    const blockedDates = await readBlockedDates(env);
    return json({
      date,
      available: !blockedDates.includes(date),
    });
  } catch {
    return json({
      error: "temporarily_unavailable",
      message: "Die Terminprüfung ist gerade nicht verfügbar.",
    }, 503);
  }
}

export function onRequest() {
  return methodNotAllowed("GET, OPTIONS");
}
