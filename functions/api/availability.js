import { writeAgentAvailabilityAudit } from "../_agent-audit.js";
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

async function checkAvailability({ request, env }) {
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

// One observation per actual check. The HTML adapter supplies its own receipt and
// original request so its source remains visible, without duplicate audit rows.
export async function onRequestGet({ request, env, audit = true }) {
  const response = await checkAvailability({ request, env });
  if (!audit) return response;
  const dates = new URL(request.url).searchParams.getAll("date");
  if (dates.length !== 1 || !parseDateValue(dates[0])) return response;
  const payload = await response.clone().json();
  const id = crypto.randomUUID();
  try {
    await writeAgentAvailabilityAudit({ id, env, request, dates,
      results: response.ok && typeof payload.available === "boolean" ? [{ date: dates[0], available: payload.available }] : [],
      responseStatus: response.status,
    });
    response.headers.set("X-Artbild-Check-Id", id);
  } catch {
    // Observability must not prevent a visitor from checking a date.
    console.error("Availability observation could not be stored");
  }
  return response;
}
