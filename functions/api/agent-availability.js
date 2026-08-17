import {
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  AGENT_RATE_LIMIT_WINDOW_MS,
  reserveAgentAvailabilityRequest,
  retryAfterSeconds,
} from "../_agent-rate-limit.js";
import {
  AGENT_AVAILABILITY_MAX_BODY_BYTES,
  AGENT_AVAILABILITY_MAX_DATES,
  AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS,
  AGENT_AVAILABILITY_MINIMUM_ADVANCE_MONTHS,
  agentAvailabilityDateBounds,
} from "../_agent-availability-contract.js";
import {
  json,
  methodNotAllowed,
  parseDateValue,
  readBlockedDates,
} from "../_availability.js";

const ADVICE_MESSAGE = "Die Verfügbarkeitsauskunft ist unverbindlich. Hochzeiten bitte mindestens sechs Monate im Voraus anfragen.";

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "GET, POST, OPTIONS",
      "Accept-Post": "application/json",
    },
  });
}

function badRequest(message) {
  return json({ error: "bad_request", message }, 400);
}

async function readLimitedBody(request) {
  const declaredLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (
    Number.isFinite(declaredLength)
    && declaredLength > AGENT_AVAILABILITY_MAX_BODY_BYTES
  ) {
    return { tooLarge: true };
  }

  if (!request.body) return { text: "" };

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > AGENT_AVAILABILITY_MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { invalidEncoding: true };
  }
}

async function parsePayload(request) {
  const mediaType = (request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return {
      response: json(
        {
          error: "unsupported_media_type",
          message: "Bitte application/json senden.",
        },
        415,
      ),
    };
  }

  const body = await readLimitedBody(request);
  if (body.tooLarge) {
    return {
      response: json(
        { error: "payload_too_large", message: "Die Anfrage ist zu groß." },
        413,
      ),
    };
  }
  if (body.invalidEncoding) {
    return { response: badRequest("Bitte gültiges UTF-8-JSON senden.") };
  }

  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return { response: badRequest("Bitte gültiges JSON senden.") };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { response: badRequest("Bitte ein Objekt mit dem Feld dates senden.") };
  }

  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "dates") {
    return { response: badRequest("Erlaubt ist ausschließlich das Feld dates.") };
  }
  if (
    !Array.isArray(payload.dates)
    || payload.dates.length < 1
    || payload.dates.length > AGENT_AVAILABILITY_MAX_DATES
  ) {
    return { response: badRequest("Bitte ein bis drei unterschiedliche Daten senden.") };
  }

  const dates = payload.dates.map((value) => parseDateValue(value));
  if (dates.some((date) => !date)) {
    return { response: badRequest("Bitte gültige Daten im Format YYYY-MM-DD senden.") };
  }
  if (new Set(dates).size !== dates.length) {
    return { response: badRequest("Bitte jedes Datum nur einmal senden.") };
  }
  const { minDate, maxDate } = agentAvailabilityDateBounds();
  if (dates.some((date) => date < minDate)) {
    return { response: badRequest("Vergangene Daten können nicht geprüft werden.") };
  }
  if (dates.some((date) => date > maxDate)) {
    return {
      response: badRequest(
        `Bitte Daten innerhalb der nächsten ${AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS} Monate senden.`,
      ),
    };
  }

  return { dates };
}

export function onRequestOptions() {
  return optionsResponse();
}

export function onRequestGet() {
  const { minDate, maxDate } = agentAvailabilityDateBounds();
  return json({
    name: "Artbild-Fotografie Agenten-Terminabfrage",
    description: "Prüft ein bis drei konkrete Wunschdaten, ohne die Liste gesperrter Termine offenzulegen.",
    endpoint: "/api/agent-availability",
    documentation: "/fuer-agenten/",
    terms: "/fuer-agenten/#konditionen",
    pricing: "/fuer-agenten/#preise",
    bookingInquiry: "/kontakt/",
    advertisingPolicy: "/fuer-agenten/#werbeverbot",
    minimumAdvanceMonths: AGENT_AVAILABILITY_MINIMUM_ADVANCE_MONTHS,
    maximumAdvanceMonths: AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS,
    maxDate,
    method: "POST",
    contentType: "application/json",
    request: {
      example: { dates: [minDate, maxDate] },
      constraints: {
        minimumDates: 1,
        maximumDates: AGENT_AVAILABILITY_MAX_DATES,
        uniqueDates: true,
        format: "YYYY-MM-DD",
        minDate,
        maxDate,
      },
    },
    response: {
      fields: ["results", "advice.message", "rateLimit.remaining", "rateLimit.resetAt"],
      availabilityIsNonBinding: true,
    },
    rateLimit: {
      maximumSuccessfulRequests: AGENT_RATE_LIMIT_MAX_REQUESTS,
      windowHours: AGENT_RATE_LIMIT_WINDOW_MS / (60 * 60 * 1000),
    },
  });
}

export async function onRequestPost({ request, env }) {
  let parsed;
  try {
    parsed = await parsePayload(request);
  } catch {
    return badRequest("Die Anfrage konnte nicht gelesen werden.");
  }
  if (parsed.response) return parsed.response;

  let blockedDates;
  try {
    blockedDates = await readBlockedDates(env);
  } catch {
    return json(
      {
        error: "temporarily_unavailable",
        message: "Die Terminprüfung ist gerade nicht verfügbar.",
      },
      503,
    );
  }

  let rateLimit;
  try {
    rateLimit = await reserveAgentAvailabilityRequest(request, env);
  } catch {
    return json(
      {
        error: "temporarily_unavailable",
        message: "Die Agenten-Terminprüfung ist gerade nicht verfügbar.",
      },
      503,
    );
  }

  if (!rateLimit.allowed) {
    return json(
      {
        error: "rate_limited",
        message: "Innerhalb von 24 Stunden sind höchstens zwei erfolgreiche Terminabfragen möglich.",
        results: [],
        advice: { message: ADVICE_MESSAGE },
        rateLimit: {
          limit: rateLimit.limit,
          remaining: 0,
          resetAt: rateLimit.resetAt,
        },
      },
      429,
      { "Retry-After": String(retryAfterSeconds(rateLimit)) },
    );
  }

  return json({
    results: parsed.dates.map((date) => ({
      date,
      available: !blockedDates.includes(date),
    })),
    advice: { message: ADVICE_MESSAGE },
    rateLimit: {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    },
  });
}

export function onRequest() {
  return methodNotAllowed("GET, POST, OPTIONS");
}
