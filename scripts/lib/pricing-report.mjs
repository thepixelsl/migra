export const PAGE_URL = "https://artbild-fotografie.de/hochzeitsfotograf-preise/";
export const PAGE_PATH = "/hochzeitsfotograf-preise/";
export const MEASUREMENT = "hochzeitsfotograf_preise";
export const EVENT_NAMES = ["price_package_view", "price_package_click", "price_calculator_change", "price_contact_click", "generate_lead"];
export const PACKAGES = ["pure_moments", "standesamt", "rundum_sorglos"];
export const KEYWORDS = ["hochzeitsfotograf hamburg preise", "hochzeitsfotograf preise", "hochzeitsfotograf kosten", "hochzeitsfotografie preise", "standesamt fotograf hamburg preise", "hochzeitsreportage hamburg preise"];
export function dateInZone(now, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function shiftDay(day, offset) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
const filter = (fieldName, value) => ({ filter: { fieldName, stringFilter: { matchType: "EXACT", value, caseSensitive: true } } });
export function gscRequest(startDate, endDate, dimensions = ["date"], startRow = 0) {
  return { startDate, endDate, dimensions, type: "web", dataState: "final", aggregationType: "auto", rowLimit: 25000, startRow,
    dimensionFilterGroups: [{ groupType: "and", filters: [{ dimension: "page", operator: "equals", expression: PAGE_URL }] }] };
}
export function gaRequest(startDate, endDate, dimensions, metrics, pricingEvents = false, additional = []) {
  return { dateRanges: [{ startDate, endDate }], dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })),
    dimensionFilter: { andGroup: { expressions: [filter("hostName", "artbild-fotografie.de"),
      pricingEvents ? filter("customEvent:measurement_page", MEASUREMENT) : filter("pagePath", PAGE_PATH),
      ...(pricingEvents ? [{ filter: { fieldName: "eventName", inListFilter: { values: EVENT_NAMES, caseSensitive: true } } }] : [filter("eventName", "page_view")]), ...additional] } },
    limit: "100000", keepEmptyRows: false, returnPropertyQuota: true };
}
export function gaRows(response) {
  return (response.rows || []).map(row => Object.fromEntries([
    ...(response.dimensionHeaders || []).map((header, i) => [header.name.replace("customEvent:", ""), row.dimensionValues[i].value]),
    ...(response.metricHeaders || []).map((header, i) => [header.name, Number(row.metricValues[i].value)]),
  ]));
}
export function gscMetrics(row) {
  if (!row) return null;
  return { clicks: row.clicks, impressions: row.impressions, ctr: row.impressions ? row.ctr : null, position: row.impressions ? row.position : null };
}
export function compareGsc(current, prior) {
  if (!current || !prior) return null;
  return Object.fromEntries(["clicks", "impressions", "ctr", "position"].map(key => [key,
    current[key] == null || prior[key] == null ? null : current[key] - prior[key]]));
}
const number = value => value == null ? "nicht verfügbar" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
const percent = value => value == null ? "nicht verfügbar" : `${number(value * 100)} %`;
export function renderPricingReport(report) {
  const lines = [`# Täglicher Bericht: Hochzeitsfotograf-Preise`, "", `Erstellt: ${report.generatedAt} · Berichtsdatum: ${report.reportDate} · Europe/Berlin`,
    `Seite: ${PAGE_URL}`, "", `Gesamtstatus: ${report.status === "complete" ? "Datenquellen erreichbar" : "unvollständig"}. Produktive Ereignismessung seit: ${report.trackingLiveSince || "noch nicht bestätigt"}.`, "",
    "## Google-Suche", "", `Quelle: Search Console API, Websuche, exakte kanonische URL, alle Länder/Geräte, Tagesgrenzen America/Los_Angeles. Nur finale Daten mit mindestens drei Tagen Abstand.`, ""];
  const gsc = report.searchConsole;
  if (gsc.status !== "ok") lines.push(`Nicht verfügbar: ${gsc.error}.`);
  else {
    lines.push(`Jüngster verfügbarer Tag: ${gsc.latestDate || "unbekannt"}. Angefragt bis: ${gsc.requestedThrough}.`, "", "| Kennzahl | Wert | Änderung zum Vortag | Änderung zur Vorwoche |", "| --- | ---: | ---: | ---: |");
    for (const [key, label] of [["clicks", "Google-Klicks"], ["impressions", "Impressionen"], ["ctr", "CTR"], ["position", "Durchschnittliche Position"]]) {
      const value = gsc.latest?.[key];
      const change = delta => delta == null ? "nicht verfügbar" : `${number(key === "ctr" ? delta * 100 : delta)}${key === "ctr" ? " Prozentpunkte" : ""}`;
      lines.push(`| ${label} | ${key === "ctr" ? percent(value) : number(value)} | ${change(gsc.changeDay?.[key])} | ${change(gsc.changeWeek?.[key])} |`);
    }
    lines.push("", "Bei Positionen bedeutet ein negativer Unterschied eine Verbesserung. Fehlende Tage sind unbekannt. URL-Gesamtwerte werden separat abgefragt und nicht aus Suchbegriffen summiert.", "", "| Suchbegriff am jüngsten Tag | Klicks | Impressionen | CTR | Position | Δ Position Vortag | Δ Position Vorwoche |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const row of gsc.keywords) lines.push(`| ${String(row.query).replace(/[|\r\n]/g, " ")} | ${number(row.clicks)} | ${number(row.impressions)} | ${percent(row.ctr)} | ${number(row.position)} | ${number(row.changeDay?.position)} | ${number(row.changeWeek?.position)} |`);
    if (!gsc.keywords.length) lines.push("| Keine sichtbaren Query-Zeilen; kein Nachweis fehlender Nachfrage | | | | | | |");
    lines.push("", "Search Console liefert unter anderem aus Datenschutzgründen nur einen Teil der Suchbegriffe. Durchschnittliche Positionen sind keine feste SERP-Platzierung.");
  }
  lines.push("", "## Besucher und Anfragen", "");
  const ga = report.analytics;
  if (ga.status !== "ok") lines.push(`Nicht verfügbar: ${ga.error}.`);
  else {
    lines.push(`GA4-Property-Zeitzone: ${ga.timeZone}. Gestern (${ga.yesterday}) ist vorläufig; stabile Vergleiche verwenden ${ga.comparisonDate} (D−3). Datenstand und Schwellenwerte stehen im JSON.`, "");
    if (ga.evidence?.some(x => x.metadata?.subjectToThresholding || x.metadata?.samplingMetadatas?.length || x.metadata?.dataLossFromOtherRow)) lines.push("Achtung: Google kennzeichnet mindestens eine Teilabfrage mit Datenschutzschwellenwerten, Stichprobe oder Datenverlust. Werte sind entsprechend eingeschränkt; Unterschiede nicht als belastbare Vollerhebung interpretieren.", "");
    for (const day of [ga.yesterday, ga.comparisonDate]) {
      const date = day.replaceAll("-", "");
      const traffic = ga.traffic.find(row => row.date === date);
      const leads = ga.totals.find(row => row.date === date && row.eventName === "generate_lead");
      // A missing event row is not reported as a measured zero before launch/freshness verification.
      lines.push(`### ${day}`, "", `Besucher (GA4 totalUsers mit Seitenaufruf): ${number(traffic?.totalUsers)}. Seitenaufrufe: ${number(traffic?.screenPageViews)}. Erfolgreiche Anfragen: ${number(leads?.eventCount)}.`,
        `Tagesbezogene Anfrage-Nutzerrate: ${percent(traffic?.totalUsers && leads ? leads.totalUsers / traffic.totalUsers : null)}. Anfragende Nutzer / Preis-Seitenbesucher am selben Berichtstag; keine Kohorten- oder Buchungsquote.`, "",
        "| Paket | Besucher mit Sichtkontakt | Sichtkontakte | Paketklicks | Anfragebutton-Klicks | Erfolgreiche Anfragen | Anfrage-Nutzerrate |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
      for (const name of PACKAGES) {
        const event = eventName => ga.packages.find(row => row.date === date && row.package_name === name && row.eventName === eventName);
        const view = event("price_package_view"), lead = event("generate_lead");
        lines.push(`| ${name} | ${number(view?.totalUsers)} | ${number(view?.eventCount)} | ${number(event("price_package_click")?.eventCount)} | ${number(event("price_contact_click")?.eventCount)} | ${number(lead?.eventCount)} | ${percent(view?.totalUsers && lead ? lead.totalUsers / view.totalUsers : null)} |`);
      }
    }
    lines.push("", "Sichtkontakt: Paketüberschrift mindestens 50 % für eine Sekunde bei sichtbarem Tab und Statistik-Einwilligung; höchstens einmal je Dokument. Ein Besucher kann mehrere Pakete sehen. Nutzerzahlen werden niemals über Pakete, Stunden, Tage oder Quellen addiert.", "",
      "### Gewünschte Begleitungsdauer", "", "| Tag | Paket | ausdrücklich gewählte Stunden | Auswahländerungen |", "| --- | --- | ---: | ---: |");
    for (const row of ga.hours) lines.push(`| ${row.date} | ${row.package_name} | ${row.hours} | ${number(row.eventCount)} |`);
    if (!ga.hours.length) lines.push("| Keine verfügbaren Auswahlereignisse | | | |");
    lines.push("", "### Instagram und Google", "", "| Quelle | Tag | Besucher | bestätigte Anfragen | Anfrage-Nutzerrate |", "| --- | --- | ---: | ---: | ---: |");
    for (const group of ga.channels) for (const day of [ga.yesterday, ga.comparisonDate]) {
      const date = day.replaceAll("-", "");
      const visitors = group.traffic.find(row => row.date === date)?.totalUsers;
      const lead = group.totals.find(row => row.date === date && row.eventName === "generate_lead");
      lines.push(`| ${group.source} | ${day} | ${number(visitors)} | ${number(lead?.eventCount)} | ${percent(visitors && lead ? lead.totalUsers / visitors : null)} |`);
    }
    lines.push("", "Quelle: GA4-Sitzungsquelle. Instagram ohne Referrer/korrekte UTM-Zuordnung bleibt unbekannt. Quellenunterschiede sind beschreibend, kein Kausalnachweis. Einwilligungsablehnung und blockierte Tags begrenzen alle Besucherzahlen. Kontaktklicks sind keine Anfragen; E-Mail, Telefon, WhatsApp und sicherer Kontakt liefern keinen bestätigten Abschluss an dieses Formulartracking.");
  }
  lines.push("", "## Keyword-Suchvolumen", "", "Tatsächliches gesamtes Suchvolumen: nicht verfügbar. Search-Console-Impressionen sind Sichtkontakte dieser URL und kein Suchvolumen.");
  const kw = report.keywordPlanner;
  if (kw.status !== "ok") lines.push(`Keyword Planner nicht verfügbar: ${kw.error}.`);
  else {
    lines.push("", "Die folgenden Originalwerte sind von Google bereitgestellte ungefähre historische Suchvolumina einschließlich ähnlicher Varianten. Sie sind Schätzwerte, keine gemessenen Gesamt-Suchzahlen. Ziel: Deutschland, Deutsch, Google ohne Suchpartner.", "", "| Keyword | Monat | Google-Planner-Schätzwert |", "| --- | --- | ---: |");
    for (const row of kw.results) for (const month of row.keywordMetrics?.monthlySearchVolumes || []) lines.push(`| ${row.text} | ${month.year}-${month.month} | ${number(month.monthlySearches == null ? null : Number(month.monthlySearches))} |`);
  }
  lines.push("", "## Betrieb und Datenqualität", "", "API-Fehler, fehlende Daten, Schwellenwerte und noch nicht registrierte Dimensionen werden nicht durch Nullen oder Beispieldaten ersetzt. Rohantworten und Prüfinformationen liegen ausschließlich im privaten JSON-Bericht. Fehlende Ereigniszeilen werden konservativ als nicht verfügbar dargestellt.", "",
    "API-Dokumentation: https://developers.google.com/webmaster-tools/v1/searchanalytics/query · https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema · https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics", "");
  return lines.join("\n");
}
