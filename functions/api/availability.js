import {
  json,
  methodNotAllowed,
  parseDateValue,
  readBlockedDates,
} from "../_availability.js";
import {
  publicAvailabilityRetryAfterSeconds,
  reservePublicAvailabilityDate,
} from "../_public-availability-rate-limit.js";

const RATE_LIMIT_MESSAGE = "Innerhalb von 24 Stunden können höchstens drei unterschiedliche Kalendertage automatisch geprüft werden.";

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
    let rateLimit;
    try {
      rateLimit = await reservePublicAvailabilityDate(request, env, date);
    } catch {
      return json({
        status: "temporarily_disabled",
        message: "Die automatische Terminprüfung ist gerade nicht verfügbar. Bitte sendet mir euren Wunschtermin über das Kontaktformular - ich prüfe ihn persönlich.",
        action_label: "Termin persönlich anfragen",
        action_href: "/kontakt/#kontaktformular",
      }, 503);
    }

    if (!rateLimit.allowed) {
      return json(
        {
          status: "rate_limited",
          message: RATE_LIMIT_MESSAGE,
          action_label: "Zum Kontaktformular",
          action_href: "/kontakt/#kontaktformular",
        },
        429,
        {
          "Retry-After": String(publicAvailabilityRetryAfterSeconds(rateLimit)),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": "0",
          ...(rateLimit.resetAt ? { "X-RateLimit-Reset": rateLimit.resetAt } : {}),
        },
      );
    }

    return json(
      {
        date,
        available: !blockedDates.includes(date),
      },
      200,
      {
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        ...(rateLimit.resetAt ? { "X-RateLimit-Reset": rateLimit.resetAt } : {}),
      },
    );
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
