import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { googleClient, googleClientWithCredentials, readPrivateFile, GoogleAccessError } from "./lib/pricing-google.mjs";
import { PAGE_URL, KEYWORDS, dateInZone, shiftDay, gscRequest, gaRequest, gaRows, gscMetrics, compareGsc, renderPricingReport } from "./lib/pricing-report.mjs";

const safeError = error => ({ status: "unavailable", error: error instanceof GoogleAccessError
  ? `${error.code}${error.status ? ` (HTTP ${error.status})` : ""}` : error.code === "ENOENT" ? "credentials_missing" : "request_failed" });
const attempt = async task => { try { return await task(); } catch (error) { return safeError(error); } };
async function writeAtomic(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, value, { mode: 0o600 }); await rename(temp, path);
}
export async function collectSearchConsole(api, now) {
  const endDate = shiftDay(dateInZone(now, "America/Los_Angeles"), -3);
  const startDate = shiftDay(endDate, -34);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent("https://artbild-fotografie.de/")}/searchAnalytics/query`;
  const series = await api(endpoint, gscRequest(startDate, endDate));
  const rows = (series.rows || []).sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const latestDate = rows.at(-1)?.keys[0] || null;
  const latest = gscMetrics(rows.at(-1));
  const byDate = new Map(rows.map(row => [row.keys[0], gscMetrics(row)]));
  const queryDays = latestDate ? [latestDate, shiftDay(latestDate, -1), shiftDay(latestDate, -7)] : [];
  const queries = [];
  for (const date of queryDays) {
    const day = [];
    for (let startRow = 0; ; startRow += 25000) {
      const response = await api(endpoint, gscRequest(date, date, ["query"], startRow));
      day.push(...(response.rows || []));
      if ((response.rows || []).length < 25000) break;
    }
    queries.push({ date, rows: day });
  }
  const keywordMap = index => new Map((queries[index]?.rows || []).map(row => [row.keys[0], gscMetrics(row)]));
  const previous = keywordMap(1), week = keywordMap(2);
  return { status: "ok", url: PAGE_URL, timeZone: "America/Los_Angeles", dataState: "final", requestedThrough: endDate,
    latestDate, latest, changeDay: compareGsc(latest, byDate.get(shiftDay(latestDate || endDate, -1))),
    changeWeek: compareGsc(latest, byDate.get(shiftDay(latestDate || endDate, -7))),
    keywords: (queries[0]?.rows || []).map(row => ({ query: row.keys[0], ...gscMetrics(row),
      changeDay: compareGsc(gscMetrics(row), previous.get(row.keys[0])), changeWeek: compareGsc(gscMetrics(row), week.get(row.keys[0])) })),
    series, queryDays: queries, queryCoverage: "top_rows_only_anonymized_queries_omitted" };
}
export async function collectAnalytics(api, propertyId, now) {
  if (!/^\d+$/.test(propertyId || "")) throw new GoogleAccessError("ga4_property_id_missing");
  const property = await api(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`);
  if (property.timeZone !== "Europe/Berlin") throw new GoogleAccessError("ga4_timezone_must_be_Europe_Berlin");
  const metadata = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`);
  const required = ["measurement_page", "package_name", "hours", "contact_channel", "cta_position"];
  const available = new Set((metadata.dimensions || []).map(x => x.apiName));
  if (required.some(x => !available.has(`customEvent:${x}`))) throw new GoogleAccessError("ga4_custom_dimensions_missing");
  const today = dateInZone(now, "Europe/Berlin"), yesterday = shiftDay(today, -1), startDate = shiftDay(today, -10);
  const evidence = [];
  async function run(dimensions, metrics, events, additional = []) {
    const base = gaRequest(startDate, yesterday, dimensions, metrics, events, additional);
    let all = [];
    for (let offset = 0; ; offset += 100000) {
      const response = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, { ...base, offset: String(offset) });
      evidence.push({ request: { dimensions, metrics, events, offset, additional }, metadata: response.metadata,
        rowCount: response.rowCount, propertyQuota: response.propertyQuota });
      all.push(...gaRows(response));
      if (offset + (response.rows || []).length >= (response.rowCount || 0)) break;
      if (!response.rows?.length) throw new GoogleAccessError("ga4_incomplete_pagination");
    }
    return all;
  }
  const traffic = await run(["date"], ["totalUsers", "sessions", "screenPageViews"], false);
  const totals = await run(["date", "eventName"], ["totalUsers", "eventCount"], true);
  const packages = await run(["date", "eventName", "customEvent:package_name"], ["totalUsers", "eventCount"], true);
  const hours = await run(["date", "customEvent:hours", "customEvent:package_name"], ["eventCount"], true,
    [{ filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "price_calculator_change" } } }]);
  const channels = [];
  for (const [source, expression] of [["Google", "google"], ["Instagram", "(instagram|.*\\.instagram\\.com|ig)"]]) {
    const sourceFilter = [{ filter: { fieldName: "sessionSource", stringFilter: { matchType: "FULL_REGEXP", value: expression, caseSensitive: false } } }];
    channels.push({ source, traffic: await run(["date"], ["totalUsers", "screenPageViews"], false, sourceFilter),
      totals: await run(["date", "eventName"], ["totalUsers", "eventCount"], true, sourceFilter) });
  }
  return { status: "ok", timeZone: property.timeZone, yesterday, comparisonDate: shiftDay(today, -3),
    traffic, totals, packages, hours, channels, evidence, freshness: "yesterday_provisional_D_minus_3_conservative" };
}
async function collectKeywords(env, directory, now) {
  const configDir = env.PRICING_KEYWORD_CONFIG_DIR;
  if (!configDir) throw new GoogleAccessError("keyword_planner_credentials_missing");
  const cachePath = join(directory, "keyword-planner.json");
  const month = dateInZone(now, "Europe/Berlin").slice(0, 7);
  try { const cache = JSON.parse(await readPrivateFile(cachePath)); if (cache.cacheMonth === month) return cache; } catch {}
  // Reuse the existing Artbild Keyword Planner integration's private files.
  const settings = JSON.parse(await readPrivateFile(join(configDir, "settings.json")));
  const clientDocument = JSON.parse(await readPrivateFile(join(configDir, "oauth-client.json")));
  const client = clientDocument.installed || clientDocument.web;
  const credentials = { type: "authorized_user", client_id: client?.client_id, client_secret: client?.client_secret,
    refresh_token: (await readPrivateFile(join(configDir, "refresh-token"))).trim() };
  const customerId = String(settings.customer_id || "").replaceAll("-", "");
  if (!/^\d+$/.test(customerId)) throw new GoogleAccessError("ads_customer_id_missing");
  const version = env.PRICING_ADS_API_VERSION || "v23";
  if (!/^v\d+$/.test(version)) throw new GoogleAccessError("ads_api_version_invalid");
    const api = googleClientWithCredentials(credentials, ["https://www.googleapis.com/auth/adwords"]);
    const headers = { "developer-token": (await readPrivateFile(join(configDir, "developer-token"))).trim(),
      ...(settings.login_customer_id ? { "login-customer-id": String(settings.login_customer_id).replaceAll("-", "") } : {}) };
    const response = await api(`https://googleads.googleapis.com/${version}/customers/${customerId}:generateKeywordHistoricalMetrics`, {
      keywords: KEYWORDS, language: "languageConstants/1001", geoTargetConstants: ["geoTargetConstants/2276"], keywordPlanNetwork: "GOOGLE_SEARCH",
    }, headers);
  const value = { status: "ok", fetchedAt: now.toISOString(), cacheMonth: month, actualSearchVolume: null,
    valueType: "google_historical_estimates_not_measured_search_counts", country: "DE", language: "de", network: "GOOGLE_SEARCH", results: response.results || [] };
  await writeAtomic(cachePath, JSON.stringify(value, null, 2)); return value;
}
export async function collectPricingReport(env = process.env, now = new Date()) {
  const directory = resolve(env.PRICING_REPORT_DIR || join(homedir(), ".local/share/artbild-pricing-reports"));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const { stat } = await import("node:fs/promises");
  if ((await stat(directory)).mode & 0o077) throw new GoogleAccessError("report_directory_permissions");
  const reportDate = dateInZone(now, "Europe/Berlin");
  const api = () => googleClient(env.PRICING_GOOGLE_CREDENTIALS);
  const searchConsole = await attempt(async () => collectSearchConsole(await api(), now));
  const analytics = await attempt(async () => collectAnalytics(await api(), env.PRICING_GA4_PROPERTY_ID, now));
  const keywordPlanner = await attempt(() => collectKeywords(env, directory, now));
  const report = { schemaVersion: 1, page: PAGE_URL, generatedAt: now.toISOString(), reportDate, reportTimeZone: "Europe/Berlin",
    trackingLiveSince: env.PRICING_TRACKING_LIVE_SINCE || null, searchConsole, analytics, keywordPlanner,
    status: [searchConsole, analytics, keywordPlanner].every(x => x.status === "ok") ? "complete" : "incomplete" };
  const json = JSON.stringify(report, null, 2), markdown = renderPricingReport(report);
  for (const name of [reportDate, "latest"]) {
    await writeAtomic(join(directory, `${name}.json`), json);
    await writeAtomic(join(directory, `${name}.md`), markdown);
  }
  return { report, directory };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { report, directory } = await collectPricingReport();
    console.log(JSON.stringify({ status: report.status, directory, reportDate: report.reportDate,
      sources: Object.fromEntries(["searchConsole", "analytics", "keywordPlanner"].map(key => [key, report[key].status])) }));
    process.exitCode = report.status === "complete" ? 0 : 2;
  } catch (error) { console.error(safeError(error).error); process.exitCode = 1; }
}
