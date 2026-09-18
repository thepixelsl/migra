import { AGENT_AUDIT_RETENTION_MS } from "./_agent-audit.js";

const CHANNEL = "COALESCE(json_extract(metadata_json, '$.channel'), 'legacy')";
const DAY_MS = 86400000;

export function longestDateSequence(values) {
  const days = [...new Set(values)].filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  let best = { length: 0, from: "", to: "" };
  let run = 0;
  let start = "";
  let previous = NaN;
  for (const day of days) {
    const time = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(time)) continue;
    run = time - previous === DAY_MS ? run + 1 : 1;
    if (run === 1) start = day;
    if (run > best.length) best = { length: run, from: start, to: day };
    previous = time;
  }
  return best;
}

export async function readAvailabilityStatistics(env, now = Date.now()) {
  const database = env.AGENT_AUDIT_DB || env.DB;
  const since = now - AGENT_AUDIT_RETENTION_MS;
  async function query(sql, args = [since, now]) {
    const statement = database.prepare(sql).bind(...args);
    const result = await statement.all();
    return result.results || result.rows || [];
  }
  const range = "requested_at > ? AND requested_at <= ?";
  const [totals, sources, dateRows, daily, series] = await Promise.all([
    query(`SELECT COUNT(*) AS requests,
      COALESCE(SUM(response_status = 200), 0) AS successful,
      COALESCE(SUM(response_status = 429), 0) AS limited,
      COALESCE(SUM(response_status >= 500), 0) AS errors,
      COALESCE(SUM(json_array_length(results_json)), 0) AS checkedDates,
      COALESCE(SUM(requested_at > ?), 0) AS last24Hours,
      COALESCE(SUM(requested_at > ?), 0) AS last7Days,
      MIN(requested_at) AS firstRequest
      FROM agent_availability_audit WHERE ${range}`, [now - DAY_MS, now - 7 * DAY_MS, since, now]),
    query(`SELECT ${CHANNEL} AS channel, client_label AS clientLabel,
      COALESCE(json_extract(metadata_json, '$.botName'), '') AS botName,
      GROUP_CONCAT(DISTINCT identity_source) AS evidenceTypes,
      COUNT(*) AS requests, SUM(response_status = 200) AS successful,
      SUM(response_status = 429) AS limited,
      SUM(json_array_length(results_json)) AS checkedDates
      FROM agent_availability_audit WHERE ${range}
      GROUP BY channel, client_label, botName ORDER BY requests DESC, client_label`),
    query(`SELECT dates.value AS date, COUNT(*) AS requests,
      SUM(response_status = 200 AND EXISTS (
        SELECT 1 FROM json_each(a.results_json) r WHERE json_extract(r.value, '$.date') = dates.value
      )) AS successful,
      SUM(response_status = 429) AS limited
      FROM agent_availability_audit a, json_each(a.dates_json) dates
      WHERE ${range} GROUP BY dates.value ORDER BY dates.value`),
    query(`SELECT strftime('%Y-%m-%d', requested_at / 1000, 'unixepoch') AS day,
      COUNT(*) AS requests, SUM(response_status = 200) AS successful,
      SUM(response_status = 429) AS limited
      FROM agent_availability_audit WHERE ${range} GROUP BY day ORDER BY day DESC`),
    query(`SELECT strftime('%Y-%m-%d', requested_at / 1000, 'unixepoch') AS day,
      ${CHANNEL} AS channel, client_label AS clientLabel,
      json_group_array(DISTINCT dates.value) AS dates
      FROM agent_availability_audit a, json_each(a.dates_json) dates
      WHERE ${range} GROUP BY day, channel, client_label`),
  ]);
  const dates = dateRows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date)).map((row) => ({
    date: row.date, requests: Number(row.requests), successful: Number(row.successful), limited: Number(row.limited),
  }));
  const months = new Map();
  for (const date of dates) {
    const month = date.date.slice(0, 7);
    const item = months.get(month) || { month, requests: 0, successful: 0, limited: 0, uniqueDates: 0, successfulUniqueDates: 0 };
    item.requests += date.requests;
    item.successful += date.successful;
    item.limited += date.limited;
    item.uniqueDates += 1;
    item.successfulUniqueDates += Number(date.successful > 0);
    months.set(month, item);
  }
  const patterns = series.map((row) => {
    const requestedDates = JSON.parse(row.dates);
    return { day: row.day, channel: row.channel, clientLabel: row.clientLabel,
      uniqueDates: requestedDates.length, sequence: longestDateSequence(requestedDates) };
  }).filter((row) => row.sequence.length >= 7 || row.uniqueDates >= 20)
    .sort((a, b) => b.day.localeCompare(a.day) || b.uniqueDates - a.uniqueDates);
  return {
    since: new Date(since).toISOString(), until: new Date(now).toISOString(),
    totals: Object.fromEntries(Object.entries(totals[0]).map(([key, value]) => [key, value === null ? null : Number(value)])),
    sources: sources.map((row) => ({ ...row, requests: Number(row.requests), successful: Number(row.successful), limited: Number(row.limited), checkedDates: Number(row.checkedDates) })),
    months: [...months.values()], dates, daily,
    patterns: patterns.slice(0, 20), patternCount: patterns.length,
    patternExplanation: "Hinweis bei mindestens 7 aufeinanderfolgenden oder 20 verschiedenen Wunschdaten je UTC-Tag, Zugangsweg und gemeldeter Dienst-Kategorie. Mehrere Absender können zusammenfallen; dies ist kein Beweis für Scraping oder einen einzelnen Bot.",
  };
}
