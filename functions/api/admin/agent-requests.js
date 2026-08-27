import {
  AGENT_AUDIT_RETENTION_DAYS,
  readAgentAvailabilityAudit,
} from "../../_agent-audit.js";
import {
  assertAdminAccess,
  json,
  methodNotAllowed,
} from "../../_availability.js";

export async function onRequestGet({ request, env }) {
  const denied = assertAdminAccess(request, env);
  if (denied) return denied;

  try {
    return json({
      retentionDays: AGENT_AUDIT_RETENTION_DAYS,
      requests: await readAgentAvailabilityAudit(env),
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
