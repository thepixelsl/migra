import {
  AGENT_AUDIT_RETENTION_DAYS,
  readAgentAvailabilityAudit,
} from "../../_agent-audit.js";
import {
  assertAdminAccess,
  json,
  methodNotAllowed,
  readBlockedDates,
} from "../../_availability.js";
import { readAvailabilityStatistics } from "../../_availability-statistics.js";

export async function onRequestGet({ request, env }) {
  const denied = assertAdminAccess(request, env);
  if (denied) return denied;

  try {
    const days = Number(new URL(request.url).searchParams.get("days"));
    const [requests, statistics, blockedDates] = await Promise.all([
      readAgentAvailabilityAudit(env, 10), readAvailabilityStatistics(env, Date.now(), days), readBlockedDates(env),
    ]);
    return json({
      retentionDays: AGENT_AUDIT_RETENTION_DAYS,
      requests, statistics, blockedDates,
    });
  } catch {
    return json(
      {
        error: "temporarily_unavailable",
        message: "Die Agenten-Anfragen können gerade nicht geladen werden.",
      },
      503,
    );
  }
}

export function onRequest() {
  return methodNotAllowed("GET");
}
