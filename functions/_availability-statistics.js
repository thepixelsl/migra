import { AGENT_AUDIT_RETENTION_MS } from "./_agent-audit.js";

const DAY_MS = 86400000;
// The fallback deliberately leaves historical browser and mixed Meta records unverified.
const AUDIENCE = `CASE
  WHEN json_extract(metadata_json, '$.version') = 2
    AND json_extract(metadata_json, '$.audience') IN ('verified_bot','reported_bot','likely_manual','unknown')
    THEN json_extract(metadata_json, '$.audience')
  WHEN identity_source IN ('api_key','user_agent','user_agent_ip','provider_ip','automation') THEN 'reported_bot'
  ELSE 'unknown' END`;

export async function readAvailabilityStatistics(env, now = Date.now(), days = 30) {
  const database = env.AGENT_AUDIT_DB || env.DB;
  const windowDays = [7, 30].includes(Number(days)) ? Number(days) : 30;
  const since = now - Math.min(windowDays * DAY_MS, AGENT_AUDIT_RETENTION_MS);
  const cte = `WITH observations AS (SELECT *, ${AUDIENCE} AS audience,
    COALESCE(json_extract(metadata_json, '$.channel'), 'legacy') AS channel,
    COALESCE(json_extract(metadata_json, '$.botName'), '') AS botName,
    COALESCE(json_extract(metadata_json, '$.activity'), 'unknown') AS activity,
    CASE WHEN json_extract(metadata_json, '$.version') = 2
      AND json_extract(metadata_json, '$.device') IN ('desktop','mobile','tablet')
      THEN json_extract(metadata_json, '$.device') ELSE 'unknown' END AS device
    FROM agent_availability_audit WHERE requested_at > ? AND requested_at <= ?)`;
  async function query(sql) {
    const result = await database.prepare(`${cte} ${sql}`).bind(since, now).all();
    return result.results || result.rows || [];
  }
  const [totals, sources, dateSources, devices] = await Promise.all([
    query(`SELECT COUNT(*) AS requests, COALESCE(SUM(response_status = 200),0) AS successful,
      COALESCE(SUM(response_status = 429),0) AS limited, COALESCE(SUM(response_status >= 500),0) AS errors,
      COALESCE(SUM(audience = 'likely_manual'),0) AS manual,
      COALESCE(SUM(audience = 'verified_bot'),0) AS verifiedBots,
      COALESCE(SUM(audience = 'reported_bot'),0) AS reportedBots,
      COALESCE(SUM(audience = 'unknown'),0) AS unknown,
      MIN(CASE WHEN json_extract(metadata_json, '$.version') = 2 THEN requested_at END) AS differentiatedSince
      FROM observations`),
    query(`SELECT channel, audience, client_label AS clientLabel, botName, activity,
      COUNT(*) AS requests, SUM(response_status = 200) AS successful, SUM(response_status = 429) AS limited
      FROM observations GROUP BY channel, audience, client_label, botName, activity
      ORDER BY requests DESC, client_label, botName, channel, audience`),
    query(`SELECT dates.value AS date, channel, audience, client_label AS clientLabel, botName, activity,
      COUNT(*) AS requests, SUM(response_status = 200) AS successful,
      SUM(response_status = 429) AS limited,
      SUM(device = 'desktop') AS desktop, SUM(device = 'mobile') AS mobile, SUM(device = 'tablet') AS tablet,
      SUM(device = 'unknown') AS unknownDevice
      FROM observations, json_each(dates_json) dates
      GROUP BY dates.value, channel, audience, client_label, botName, activity ORDER BY dates.value`),
    query(`SELECT device, COUNT(*) AS requests FROM observations WHERE audience = 'likely_manual'
      GROUP BY device ORDER BY requests DESC, device`),
  ]);
  const sourceKey = (row) => JSON.stringify([row.channel, row.audience, row.clientLabel, row.botName, row.activity]);
  const keys = new Map(sources.map((row, index) => [sourceKey(row), index]));
  const numeric = (row, fields) => Object.fromEntries(fields.map((field) => [field, Number(row[field]) || 0]));
  return {
    windowDays, since: new Date(since).toISOString(), until: new Date(now).toISOString(),
    totals: { ...numeric(totals[0], ['requests','successful','limited','errors','manual','verifiedBots','reportedBots','unknown']),
      differentiatedSince: totals[0].differentiatedSince ? new Date(Number(totals[0].differentiatedSince)).toISOString() : null },
    sources: sources.map((row, id) => ({ ...row, id, ...numeric(row, ['requests','successful','limited']) })),
    dateSources: dateSources.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date)).map((row) => ({
      date: row.date, sourceId: keys.get(sourceKey(row)),
      ...numeric(row, ['requests','successful','limited','desktop','mobile','tablet','unknownDevice']),
    })),
    devices: devices.map((row) => ({ device: row.device, requests: Number(row.requests) })),
  };
}
