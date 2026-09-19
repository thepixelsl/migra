import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { identifyAgentClient, readAgentAvailabilityAudit, writeAgentAvailabilityAudit } from "../functions/_agent-audit.js";
import { availabilitySignals } from "../src/lib/availabilitySignals.mjs";
import { botDistribution, rankedDates } from "../src/lib/availabilityAdmin.mjs";
import { onRequestGet as adminStatistics } from "../functions/api/admin/agent-requests.js";
import { availabilityChannel } from "../functions/_agent-identity.js";
import { readAvailabilityStatistics } from "../functions/_availability-statistics.js";
import { createBunnyDatabase } from "../server/bunny-database.mjs";
import { createBunnyRuntime } from "../server/bunny-server.mjs";
import { compileNetworkList, createAgentNetworkRegistry } from "../server/agent-networks.mjs";

const request = (ua = "", headers = {}) => new Request("https://artbild-fotografie.de/api/availability?date=2027-06-01", { headers: { "User-Agent": ua, ...headers } });

test("identifies providers without mistaking a browser or generic Google fetch for a known AI", async () => {
  for (const [ua, expected] of [["ChatGPT-User/1.0", "ChatGPT"], ["Claude-User/1.0", "Claude"], ["PerplexityBot/1.0", "Perplexity"], ["Google-CloudVertexBot/1.0", "Google (Dienst unklar)"], ["Gemini/1.0", "Gemini"], ["Mozilla/5.0 Chrome/120 Safari/1", "Browser (Mensch oder KI)"], ["python-httpx/1", "Anderer Agent / Abrufdienst"], ["", "Nicht identifiziert"]]) {
    const identity = await identifyAgentClient(request(ua), {});
    assert.equal(identity.clientLabel, expected);
    assert.equal(identity.clientVerified, false);
  }
  const network = { AGENT_NETWORK_LOOKUP: () => ({ provider: "Anthropic" }) };
  assert.equal((await identifyAgentClient(request("Claude-User/1.0"), network)).identitySource, "user_agent_ip");
  const conflict = await identifyAgentClient(request("ChatGPT-User/1.0"), network);
  assert.equal(conflict.identitySource, "user_agent");
  assert.match(conflict.evidence, /nicht dazu/);
  assert.equal((await identifyAgentClient(request("Mozilla/5.0"), network)).identitySource, "provider_ip");
  const authenticated = await identifyAgentClient(request("Claude-User/1.0", { Authorization: "Bearer example-test-key-123456789" }), { AGENT_API_CLIENTS_JSON: JSON.stringify({ "Eigener Assistent": "example-test-key-123456789" }) });
  assert.equal(authenticated.clientVerified, true);
  assert.equal(authenticated.clientLabel, "Eigener Assistent");
});

test("source markers describe entry points, not human or bot identity", () => {
  assert.equal(availabilityChannel(request("", { "X-Artbild-Availability-Source": "fab" })), "fab");
  assert.equal(availabilityChannel(request("", { "X-Artbild-Availability-Source": "agent_form" })), "agent_form");
  assert.equal(availabilityChannel(request("", { "X-Artbild-Availability-Source": "arbitrary" })), "api");
  assert.equal(availabilityChannel(new Request("https://example.com/agenten-test/2027-01-01/", { headers: { "X-Artbild-Availability-Source": "fab" } })), "agent_html");
});

test("official network matching handles IPv4, IPv6, invalid data and expiry after failed refresh", async () => {
  const list = compileNetworkList({ prefixes: [{ ipv4Prefix: "198.51.100.0/24" }, { ipv6Prefix: "2001:db8::/32" }] });
  assert.equal(list.check("198.51.100.7"), true);
  assert.equal(list.check("198.51.101.7"), false);
  assert.equal(list.check("2001:db8::123", "ipv6"), true);
  assert.throws(() => compileNetworkList({ prefixes: [{ ipv4Prefix: "0.0.0.0/0" }] }));
  let now = 1000;
  let failed = false;
  const registry = createAgentNetworkRegistry({ now: () => now, sources: [["Example", "https://example.com/bots.json"]], fetcher: async () => {
    if (failed) throw new Error("offline");
    return Response.json({ prefixes: [{ ipv4Prefix: "198.51.100.0/24" }] });
  } });
  await registry.refresh();
  assert.equal(registry.lookup("198.51.100.7").provider, "Example");
  assert.equal(registry.lookup("198.51.100.7, 1.1.1.1"), null);
  failed = true; await registry.refresh();
  assert.ok(registry.lookup("198.51.100.7"));
  now += 86400001;
  assert.equal(registry.lookup("198.51.100.7"), null);
  registry.close();
});

async function databaseFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artbild-observations-"));
  const config = { BUNNY_DATABASE_URL: `file:${path.join(directory, "audit.db")}` };
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, config };
}

test("migrates an existing audit table additively and preserves historical observations", async (t) => {
  const { config } = await databaseFixture(t);
  const old = createClient({ url: config.BUNNY_DATABASE_URL });
  await old.execute("CREATE TABLE agent_availability_audit (id TEXT PRIMARY KEY, requested_at INTEGER NOT NULL, client_label TEXT NOT NULL, identity_source TEXT NOT NULL, client_verified INTEGER NOT NULL DEFAULT 0, dates_json TEXT NOT NULL, results_json TEXT NOT NULL, response_status INTEGER NOT NULL)");
  await old.execute({ sql: "INSERT INTO agent_availability_audit VALUES ('old', ?, 'Nicht identifiziert', 'unknown', 0, '[\"2027-01-01\"]', '[]', 429)", args: [Date.now()] });
  old.close();
  const database = await createBunnyDatabase(config);
  const env = { AGENT_AUDIT_DB: database.d1 };
  t.after(() => database.close());
  assert.equal((await readAgentAvailabilityAudit(env))[0].channel, "legacy");
  await writeAgentAvailabilityAudit({ env, request: request("Claude-User/1.0 private-build", { "X-Real-IP": "192.0.2.4" }), dates: ["2027-06-01"], results: [{ date: "2027-06-01", available: true }], responseStatus: 200 });
  const rows = await readAgentAvailabilityAudit(env);
  assert.equal(rows.length, 2);
  assert.doesNotMatch(JSON.stringify(rows), /private-build|192\.0\.2\.4/);
  const restarted = await createBunnyDatabase(config);
  assert.equal((await readAgentAvailabilityAudit({ AGENT_AUDIT_DB: restarted.d1 })).length, 2);
  restarted.close();
});

test("counts the full retention window beyond the 100 details and distinguishes blocked scraping attempts", async (t) => {
  const { config } = await databaseFixture(t);
  const database = await createBunnyDatabase(config);
  t.after(() => database.close());
  const env = { AGENT_AUDIT_DB: database.d1 };
  const now = Date.now();
  for (let index = 0; index < 127; index++) {
    const date = index < 120 ? "2027-03-01" : `2027-03-${String(index - 118).padStart(2, "0")}`;
    await writeAgentAvailabilityAudit({ id: `observation-${index}`, env, request: request("Claude-User/1.0"), dates: [date], results: index < 120 ? [{ date, available: true }] : [], responseStatus: index < 120 ? 200 : 429, requestedAt: now - 1000 });
  }
  await writeAgentAvailabilityAudit({ id: "expired", env, request: request(), dates: ["2027-10-01"], results: [], responseStatus: 429, requestedAt: now - 31 * 86400000 });
  const statistics = await readAvailabilityStatistics(env, now);
  assert.equal((await readAgentAvailabilityAudit(env)).length, 100);
  assert.equal(statistics.totals.requests, 127);
  assert.equal(statistics.totals.successful, 120);
  assert.equal(statistics.totals.limited, 7);
  assert.equal(statistics.totals.reportedBots, 127);
  assert.equal(statistics.totals.manual, 0);
  assert.equal(statistics.sources[0].requests, 127);
  assert.equal(statistics.dateSources.length, 8);
  assert.equal(rankedDates(statistics, {mode: "api"})[0].requests, 120);
  assert.equal(rankedDates(statistics).length, 0);
  assert.equal((await readAgentAvailabilityAudit(env, 10)).length, 10);
  const adminRequest = new Request('https://example.com/api/admin/agent-requests?days=7', {headers:{'Cf-Access-Authenticated-User-Email':'info@artbild-fotografie.de'}});
  const response = await adminStatistics({request:adminRequest, env:{...env,AVAILABILITY_KV:{get:async()=>JSON.stringify(['2027-03-01'])}}});
  const payload = await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.requests.length,10);
  assert.equal(payload.statistics.totals.requests,127);
  assert.equal(payload.statistics.windowDays,7);
  assert.deepEqual(payload.blockedDates,['2027-03-01']);
  assert.equal((await adminStatistics({request:request(),env})).status,401);

});

test("FAB, direct API, alias and HTML each record once and share the date limit", async (t) => {
  const { config, directory } = await databaseFixture(t);
  const runtime = await createBunnyRuntime({ env: { ...config, NODE_ENV: "test", AGENT_RATE_LIMIT_SALT: "example-salt-of-at-least-32-characters" }, assetDirectory: directory });
  const address = await runtime.listen({ host: "127.0.0.1", port: 0 });
  t.after(() => runtime.close());
  const base = `http://127.0.0.1:${address.port}`;
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 60);
  const value = date.toISOString().slice(0, 10);
  const headers = { "X-Real-IP": "192.0.2.27", "User-Agent": "Mozilla/5.0 Chrome/120" };
  const fab = await fetch(`${base}/api/availability?date=${value}`, { headers: { ...headers, "X-Artbild-Availability-Source": "fab" } });
  assert.equal(fab.status, 200); assert.ok(fab.headers.get("x-artbild-check-id"));
  await fetch(`${base}/api/agent-availability?date=${value}`, { headers: { ...headers, "User-Agent": "ChatGPT-User/1.0" } });
  await fetch(`${base}/api/agent-availability?date=${value}`, { headers: { ...headers, "X-Artbild-Availability-Source": "agent_form" } });
  const html = await fetch(`${base}/agenten-test/${value}/`, { headers });
  assert.equal(html.status, 200);
  const audit = await readAgentAvailabilityAudit({ AGENT_AUDIT_DB: runtime.database.d1 });
  assert.equal(audit.length, 4);
  assert.deepEqual(audit.map((row) => row.channel).sort(), ["agent_form", "agent_html", "api", "fab"]);
  assert.equal(audit.find((row) => row.channel === "fab").clientLabel, "Browser (Mensch oder KI)");
  assert.equal(audit.find((row) => row.channel === "api").clientLabel, "ChatGPT");
  const count = await runtime.database.client.execute("SELECT COUNT(*) AS n FROM public_availability_requests");
  assert.equal(Number(count.rows[0].n), 1);
  await fetch(`${base}/agenten-test/${value}/`, { headers, method: "HEAD" });
  await fetch(`${base}/api/availability?date=invalid`, { headers });
  assert.equal((await readAgentAvailabilityAudit({ AGENT_AUDIT_DB: runtime.database.d1 })).length, 4);
});

test("requires bot-specific network evidence and splits all Meta purposes", async () => {
  const ua = request('ChatGPT-User/1.0');
  const providerOnly = {AGENT_NETWORK_LOOKUP: () => ({provider:'OpenAI'})};
  const wrongService = {AGENT_NETWORK_LOOKUP: () => ({provider:'OpenAI',botNames:['GPTBot']})};
  const sameService = {AGENT_NETWORK_LOOKUP: () => ({provider:'OpenAI',botNames:['ChatGPT-User']})};
  assert.equal((await identifyAgentClient(ua,{})).audience,'reported_bot');
  assert.equal((await identifyAgentClient(ua,providerOnly)).audience,'reported_bot');
  assert.equal((await identifyAgentClient(ua,wrongService)).audience,'reported_bot');
  assert.equal((await identifyAgentClient(ua,sameService)).audience,'verified_bot');
  for(const [token,activity] of [['facebookexternalhit','preview'],['meta-externalagent','crawler'],['meta-externalfetcher','user'],['meta-webindexer','search'],['meta-externalads','ads']]) {
    const identity=await identifyAgentClient(request(`${token}/1.1`,{'X-Artbild-Availability-Source':'fab','X-Artbild-Interaction':'browser'}),{});
    assert.equal(identity.botName.toLowerCase(),token);assert.equal(identity.activity,activity);assert.equal(identity.audience,'reported_bot');
  }
});

test("estimates manual devices only with a form interaction and preserves automation signals", async () => {
  const headers={'X-Artbild-Availability-Source':'fab','X-Artbild-Interaction':'browser'};
  for(const [ua,device] of [['Mozilla/5.0 (Windows NT 10.0) Chrome/140','desktop'],['Mozilla/5.0 (iPhone) Mobile/15 Safari/1','mobile'],['Mozilla/5.0 (iPad) Safari/1','tablet'],['Mozilla/5.0 (Linux; Android 12) Chrome/1','tablet']]) {
    const identity=await identifyAgentClient(request(ua,headers),{});
    assert.equal(identity.audience,'likely_manual');assert.equal(identity.device,device);
  }
  const browser='Mozilla/5.0 (Macintosh) Safari/1';
  assert.equal((await identifyAgentClient(request(browser,{...headers,'X-Artbild-Device':'tablet'}),{})).device,'tablet');
  assert.equal((await identifyAgentClient(request(browser),{})).audience,'unknown');
  assert.equal((await identifyAgentClient(request(browser,{'X-Artbild-Availability-Source':'fab'}),{})).audience,'unknown');
  assert.equal((await identifyAgentClient(request('Mozilla/5.0 HeadlessChrome/1',headers),{})).audience,'reported_bot');
  assert.equal((await identifyAgentClient(request(browser,{...headers,'X-Artbild-Interaction':'automated'}),{})).audience,'reported_bot');
  assert.equal(availabilitySignals({isTrusted:true},{webdriver:true})['X-Artbild-Interaction'],'automated');
  assert.equal(availabilitySignals({isTrusted:true,agentInvoked:true},{})['X-Artbild-Interaction'],'automated');
  assert.equal(availabilitySignals({isTrusted:false},{})['X-Artbild-Interaction'],'unknown');
  assert.equal(availabilitySignals({isTrusted:true},{})['X-Artbild-Interaction'],'browser');
});

test("reconciles dashboard populations, date ranking, multi-date requests and historical gaps", async(t) => {
  const {config}=await databaseFixture(t);const db=await createBunnyDatabase(config);t.after(()=>db.close());
  const env={AGENT_AUDIT_DB:db.d1};const now=Date.now();
  async function add(id,ua,headers,dates,age=1,status=200,network=null) {
    await writeAgentAvailabilityAudit({id,env:{...env,AGENT_NETWORK_LOOKUP:()=>network},request:request(ua,headers),dates,results:status===200?dates.map(date=>({date,available:true})):[],responseStatus:status,requestedAt:now-age*86400000});
  }
  const manual={'X-Artbild-Availability-Source':'fab','X-Artbild-Interaction':'browser'};
  await add('m1','Mozilla/5.0 (Windows NT 10.0) Chrome/1',manual,['2027-05-01','2027-06-01']);
  await add('m2','Mozilla/5.0 (iPhone) Mobile/1',manual,['2027-05-01']);
  await add('m3','Mozilla/5.0 (iPad) Safari/1',manual,['2027-06-01'],10);
  await add('past','Mozilla/5.0 (iPhone) Mobile/1',manual,['2000-01-01']);
  await add('verified','ChatGPT-User/1.0',{},['2027-07-01'],1,200,{provider:'OpenAI',botNames:['ChatGPT-User']});
  await add('meta','meta-externalagent/1.1',{},['2027-07-01'],1,429);
  await add('unknown','Mozilla/5.0',{},['2027-07-01']);
  await db.client.execute({sql:`INSERT INTO agent_availability_audit (id,requested_at,client_label,identity_source,client_verified,dates_json,results_json,response_status,metadata_json) VALUES ('legacy',?,'Browser (Mensch oder KI)','browser',0,'["2027-07-01"]','[]',429,'{"version":1,"channel":"fab"}')`,args:[now-1000]});
  const stats=await readAvailabilityStatistics(env,now);
  assert.equal(stats.totals.requests,8);assert.equal(stats.totals.manual,4);assert.equal(stats.totals.verifiedBots,1);assert.equal(stats.totals.reportedBots,1);assert.equal(stats.totals.unknown,2);
  assert.equal(stats.sources.reduce((n,s)=>n+s.requests,0),8);
  assert.equal(stats.dateSources.reduce((n,s)=>n+s.requests,0),9);
  assert.equal(stats.devices.reduce((n,s)=>n+s.requests,0),4);
  assert.deepEqual(botDistribution(stats).map(row=>row.value),[1]);assert.equal(botDistribution(stats,false).length,2);
  assert.deepEqual(rankedDates(stats).map(row=>[row.date,row.requests]),[['2027-05-01',2],['2027-06-01',2]]);
  assert.equal(rankedDates(stats,{free:true,blockedDates:['2027-05-01']})[0].date,'2027-06-01');
  assert.equal(rankedDates(stats,{mode:'api'})[0].requests,4);
  assert.equal(rankedDates(stats,{mode:'api',channel:'fab'})[0].unknown,1);
  const recent=await readAvailabilityStatistics(env,now,7);assert.equal(recent.totals.manual,3);assert.equal(recent.windowDays,7);
  assert.equal((await readAgentAvailabilityAudit(env)).find(row=>row.id==='legacy').audience,'unknown');
  assert.equal((await readAgentAvailabilityAudit(env)).find(row=>row.id==='legacy').device,'unknown');
});
