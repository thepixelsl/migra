import { assertAdminAccess } from "../_availability.js";

export function onRequest(context) {
  const denied = assertAdminAccess(context.request, context.env);
  if (denied) return denied;

  return context.next();
}
