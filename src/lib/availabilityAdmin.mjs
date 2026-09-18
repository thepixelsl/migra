export const channelLabel = (channel) => ({
  fab: "FAB", api: "API direkt", agent_form: "Agentenseite / Formular",
  agent_html: "HTML-Terminseite", legacy: "Früherer Eintrag · Zugangsweg unbekannt",
}[channel] || "Unbekannt");

export const identityLabel = (source) => ({
  api_key: "API-Schlüssel bestätigt", user_agent_ip: "Kennung + Anbieter-IP",
  provider_ip: "Anbieter-IP · vermutet", user_agent: "Bot-Kennung · unbestätigt",
  automation: "Abrufwerkzeug · Dienst unklar", browser: "Browser · Mensch oder KI",
  unknown: "Herkunft unbekannt",
}[source] || "Herkunft unbekannt");

const number = (value) => new Intl.NumberFormat("de-DE").format(Number(value) || 0);
const day = (value) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const monthName = (value) => new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function table(title, headings, rows) {
  const section = element("section", undefined, "availability-observations__section");
  section.append(element("h3", title));
  const scroll = element("div", undefined, "availability-observations__table-wrap");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", title);
  const table = element("table");
  const head = element("thead");
  const tr = element("tr");
  headings.forEach((text) => { const th = element("th", text); th.scope = "col"; tr.append(th); });
  head.append(tr);
  const body = element("tbody");
  for (const row of rows) {
    const tr = element("tr");
    row.forEach((value) => tr.append(element("td", value)));
    body.append(tr);
  }
  if (!rows.length) {
    const tr = element("tr");
    const td = element("td", "Noch keine Abfragen in diesem Zeitraum.");
    td.colSpan = headings.length; tr.append(td); body.append(tr);
  }
  table.append(head, body); scroll.append(table); section.append(scroll);
  return section;
}

export function renderAvailabilityStatistics(root, statistics) {
  root.replaceChildren();
  if (!statistics) return;
  const totals = statistics.totals;
  const cards = element("div", undefined, "availability-observations__metrics");
  for (const [value, label] of [
    [totals.requests, "Abfragen · 30 Tage"], [totals.last7Days, "davon letzte 7 Tage"],
    [totals.last24Hours, "davon letzte 24 Stunden"], [totals.successful, "erfolgreiche Abfragen"],
    [totals.limited, "am Limit abgewiesen"], [totals.checkedDates, "ausgegebene Terminergebnisse"],
  ]) {
    const card = element("div"); card.append(element("strong", number(value)), element("span", label)); cards.append(card);
  }
  root.append(cards, element("p", "Gezählt werden Server-Abfragen mit gültigen Wunschdaten, keine Personen. Eine Mehrfachabfrage zählt einmal und kann bis zu drei Terminergebnisse liefern. Wiederholungen zählen erneut. FAB und direkte Einzelabfragen werden erst seit dieser Erweiterung vollständig erfasst; frühere Werte sind unvollständig.", "availability-observations__note"));
  root.append(table("Nutzung nach Zugangsweg und Dienst", ["Zugangsweg", "Erkannter Dienst / Bot", "Herkunftshinweis", "Abfragen", "Erfolgreich", "Abgewiesen"],
    statistics.sources.map((source) => [channelLabel(source.channel), `${source.clientLabel}${source.botName ? ` · ${source.botName}` : ""}`, source.evidenceTypes.split(",").map(identityLabel).join("; "), number(source.requests), number(source.successful), number(source.limited)])));
  root.append(element("p", "FAB und Formular bezeichnen den vom Aufrufer gemeldeten Zugangsweg. Browserbedienung durch Menschen und KI ist nicht zuverlässig unterscheidbar. Bot-Kennungen und weitergeleitete Anbieter-IPs sind Herkunftshinweise, keine Anmeldung. Google-Abrufe lassen sich ohne zusätzliche Kennung nicht sicher Gemini zuordnen.", "availability-observations__note"));
  const patterns = element("section", undefined, "availability-observations__patterns");
  patterns.append(element("h3", "Auffällige Kalenderabfragen"));
  patterns.append(element("p", statistics.patternExplanation));
  if (!statistics.patterns.length) patterns.append(element("p", "In den erfassten Daten wurde keine Serie oberhalb dieser Schwellen gefunden."));
  else {
    const list = element("ul");
    statistics.patterns.forEach((pattern) => list.append(element("li", `${day(pattern.day)} (UTC) · ${pattern.clientLabel} · ${channelLabel(pattern.channel)}: ${pattern.uniqueDates} unterschiedliche Wunschdaten; längste Folge ${pattern.sequence.length} Tage (${day(pattern.sequence.from)} bis ${day(pattern.sequence.to)}).`)));
    patterns.append(list);
    if (statistics.patternCount > statistics.patterns.length) patterns.append(element("p", `Die letzten ${statistics.patterns.length} von ${statistics.patternCount} auffälligen Gruppen werden angezeigt.`));
  }
  root.append(patterns);
  root.append(table("Welche Monate werden abgefragt?", ["Wunschmonat", "Datumsabfragen", "Tage angefragt", "Tage mit Auskunft", "Abgewiesen"],
    statistics.months.map((month) => {
      const [year, value] = month.month.split("-").map(Number);
      const days = new Date(Date.UTC(year, value, 0)).getUTCDate();
      return [monthName(month.month), number(month.requests), `${month.uniqueDates} / ${days}`, `${month.successfulUniqueDates} / ${days}`, number(month.limited)];
    })));
  const datesSection = element("section", undefined, "availability-observations__section");
  const label = element("label", "Wunschmonat filtern ");
  const select = element("select");
  select.setAttribute("aria-label", "Wunschmonat filtern");
  const all = element("option", "Alle Monate"); all.value = ""; select.append(all);
  statistics.months.forEach((month) => { const option = element("option", monthName(month.month)); option.value = month.month; select.append(option); });
  label.append(select); datesSection.append(label);
  const datesTable = element("div"); datesSection.append(datesTable);
  const renderDates = () => {
    const filtered = statistics.dates.filter((date) => !select.value || date.date.startsWith(select.value));
    const selected = select.value ? filtered : [...filtered].sort((a, b) => b.requests - a.requests || a.date.localeCompare(b.date)).slice(0, 30);
    datesTable.replaceChildren(table(select.value ? `Termine im ${monthName(select.value)}` : `Häufigste Wunschtermine (${selected.length} von ${filtered.length})`,
      ["Wunschtermin", "Abfragen", "Mit Auskunft", "Abgewiesen"], selected.map((date) => [day(date.date), number(date.requests), number(date.successful), number(date.limited)])));
  };
  select.addEventListener("change", renderDates); renderDates(); root.append(datesSection);
  root.append(table("Nutzung pro Tag (UTC)", ["Tag des Abrufs", "Abfragen", "Erfolgreich", "Abgewiesen"],
    statistics.daily.map((date) => [day(date.day), number(date.requests), number(date.successful), number(date.limited)])));
}
