export const channelLabel = (channel) => ({ fab: 'FAB', api: 'API', agent_form: 'Formular', agent_html: 'HTML', legacy: 'Früher' }[channel] || 'Unklar');
export const audienceLabel = (value) => ({ verified_bot: 'Bot · Netzbeleg', reported_bot: 'Bot / Client · gemeldet', likely_manual: 'Manuell · geschätzt', unknown: 'Unklar' }[value] || 'Unklar');
const deviceLabel = (value) => ({ desktop: 'Desktop', mobile: 'Mobil', tablet: 'Tablet', unknown: 'Unbekannt' }[value] || 'Unbekannt');
const number = (value) => new Intl.NumberFormat('de-DE').format(Number(value) || 0);
const day = (value) => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const time = (value) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(value));
const purpose = { FacebookExternalHit: 'Linkvorschau', 'Meta-ExternalAgent': 'KI-Crawler', 'Meta-ExternalFetcher': 'KI-Abruf', 'Meta-WebIndexer': 'KI-Suche', 'Meta-ExternalAds': 'Werbe-Crawler', 'Meta-Crawler': 'Untertyp nicht gespeichert' };
export const serviceLabel = (source) => source.botName ? `${source.botName}${purpose[source.botName] ? ` · ${purpose[source.botName]}` : ''}` : source.clientLabel;
const serviceKey = (source) => JSON.stringify([source.clientLabel, source.botName]);

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function button(label, action, className) {
  const node = el('button', label, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
function select(label, options, action) {
  const wrapper = el('label', label, 'usage-control');
  const input = el('select'); input.setAttribute('aria-label', label);
  for (const [value, text] of options) { const option = el('option', text); option.value = value; input.append(option); }
  input.addEventListener('change', () => action(input.value)); wrapper.append(input); return { wrapper, input };
}
function check(label, initial, action) {
  const wrapper = el('label', undefined, 'usage-check'); const input = el('input'); input.type = 'checkbox'; input.checked = initial;
  input.addEventListener('change', () => action(input.checked)); wrapper.append(input, document.createTextNode(label)); return wrapper;
}
function table(headings, rows, label) {
  const wrap = el('div', undefined, 'usage-table-wrap'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', label);
  const node = el('table'); const head = el('thead'); const tr = el('tr');
  headings.forEach((heading) => { const th = el('th', heading); th.scope = 'col'; tr.append(th); }); head.append(tr);
  const body = el('tbody');
  for (const values of rows) { const row = el('tr'); for (const value of values) { const cell = el('td'); cell.append(value instanceof Node ? value : document.createTextNode(String(value))); row.append(cell); } body.append(row); }
  if (!rows.length) { const row = el('tr'); const cell = el('td', 'Noch keine passenden Abfragen.'); cell.colSpan = headings.length; row.append(cell); body.append(row); }
  node.append(head, body); wrap.append(node); return wrap;
}

export function botDistribution(statistics, verifiedOnly = true) {
  const groups = new Map();
  for (const source of statistics.sources) {
    if (source.audience !== 'verified_bot' && (verifiedOnly || source.audience !== 'reported_bot')) continue;
    const key = serviceKey(source); const item = groups.get(key) || { label: serviceLabel(source), value: 0 };
    item.value += source.requests; groups.set(key, item);
  }
  return [...groups.values()].sort((a,b) => b.value-a.value || a.label.localeCompare(b.label));
}

export function rankedDates(statistics, { mode = 'manual', service = '', channel = '', future = true, free = false, blockedDates = [] } = {}) {
  const today = new Date(statistics.until).toLocaleDateString('sv-SE', {timeZone:'Europe/Berlin'});
  const blocked = new Set(blockedDates); const sources = new Map(statistics.sources.map((source) => [source.id, source])); const dates = new Map();
  for (const row of statistics.dateSources) {
    const source = sources.get(row.sourceId); if (!source) continue;
    if (mode === 'manual' ? source.audience !== 'likely_manual' : source.audience === 'likely_manual') continue;
    if (mode !== 'manual' && ((service && serviceKey(source) !== service) || (channel && source.channel !== channel))) continue;
    if ((future && row.date < today) || (free && blocked.has(row.date))) continue;
    const item = dates.get(row.date) || { date: row.date, requests: 0, successful: 0, limited: 0, desktop: 0, mobile: 0, tablet: 0, unknownDevice: 0, verified: 0, reported: 0, unknown: 0, blocked: blocked.has(row.date) };
    for (const key of ['requests','successful','limited','desktop','mobile','tablet','unknownDevice']) item[key] += row[key];
    if (source.audience === 'verified_bot') item.verified += row.requests;
    if (source.audience === 'reported_bot') item.reported += row.requests;
    if (source.audience === 'unknown') item.unknown += row.requests;
    dates.set(row.date, item);
  }
  return [...dates.values()].sort((a,b) => b.requests-a.requests || a.date.localeCompare(b.date));
}

const palette = ['#334e68','#b77d3f','#62785d','#9d5262','#736194','#76818a'];
function chart(rows, emptyMessage, device = false) {
  const figure = el('figure', undefined, 'usage-chart');
  const grouped = rows.length > 6 ? [...rows.slice(0,5), {label:'Weitere', value:rows.slice(5).reduce((n,row) => n+row.value,0)}] : rows;
  const total = grouped.reduce((n,row) => n+row.value,0);
  if (!total) { figure.append(el('div','—','usage-chart-empty'),el('figcaption',emptyMessage)); return figure; }
  const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 200 200'); svg.setAttribute('class','usage-donut'); svg.setAttribute('role','group'); svg.setAttribute('aria-label',`${number(total)} Abfragen, Anteile nach Kategorie`);
  const tooltip = el('p',`${number(total)} Abfragen`,'usage-chart-value'); tooltip.setAttribute('aria-live','polite');
  const legend = el('figcaption',undefined,'usage-legend'); let offset = 0;
  grouped.forEach((row,index) => {
    const share = row.value / total; const color = device ? ({Desktop:palette[0],Mobil:palette[1],Tablet:palette[2],Unbekannt:palette[5]}[row.label]) : palette[index];
    const circle = document.createElementNS(ns,'circle');
    for (const [key,value] of Object.entries({cx:100,cy:100,r:74,fill:'none',stroke:color,'stroke-width':28,pathLength:100,'stroke-dasharray':`${share*100} ${100-share*100}`,'stroke-dashoffset':-offset*100,transform:'rotate(-90 100 100)',tabindex:0,role:'img','aria-label':`${row.label}: ${number(row.value)} Abfragen (${number(Math.round(share*100))} %)`})) circle.setAttribute(key,String(value));
    const detail = `${row.label}: ${number(row.value)} · ${number(Math.round(share*100))} %`;
    circle.addEventListener('mouseenter',() => { tooltip.textContent=detail; }); circle.addEventListener('focus',() => { tooltip.textContent=detail; });
    circle.addEventListener('mouseleave',() => { tooltip.textContent=`${number(total)} Abfragen`; }); circle.addEventListener('blur',() => { tooltip.textContent=`${number(total)} Abfragen`; });
    svg.append(circle); offset+=share;
    const line=el('div'); const swatch=el('i'); swatch.style.backgroundColor=color; swatch.setAttribute('aria-hidden','true');
    line.append(swatch,el('span',row.label),el('strong',`${number(row.value)} · ${number(Math.round(share*100))} %`)); legend.append(line);
  });
  const center=document.createElementNS(ns,'text'); center.setAttribute('x','100');center.setAttribute('y','107');center.setAttribute('text-anchor','middle');center.textContent=number(total);svg.append(center);
  figure.append(svg,legend,tooltip); return figure;
}

export function renderAvailabilityStatistics(root, statistics, { blockedDates = [] } = {}) {
  root.replaceChildren(); if (!statistics) return;
  const totals=statistics.totals;
  const cards=el('div',undefined,'usage-metrics');
  for (const [value,label] of [[totals.manual,'Manuell · geschätzt'],[totals.verifiedBots,'Bots · mit Netzbeleg'],[totals.reportedBots+totals.unknown,'Weitere / unklar']]) {
    const card=el('div');card.append(el('strong',number(value)),el('span',label));cards.append(card);
  }
  root.append(cards);
  const charts=el('div',undefined,'usage-charts');
  const bots=el('section',undefined,'usage-chart-card'); bots.append(el('h3','Welche Bots fragen ab?'));
  const botContainer=el('div'); const proof=select('Bot-Auswahl',[['verified','Mit Netzbeleg'],['reported','Alle gemeldeten Bots / Clients']],value => {botContainer.replaceChildren(chart(botDistribution(statistics,value==='verified'),'Noch keine Bots mit passender Kennung und veröffentlichtem Bot-Netz erfasst.'));});
  botContainer.append(chart(botDistribution(statistics),'Noch keine Bots mit passender Kennung und veröffentlichtem Bot-Netz erfasst.'));
  bots.append(proof.wrapper,botContainer,el('p',`${number(totals.reportedBots)} weitere Abfragen mit unbestätigter Bot-Kennung oder Client-Hinweis.`,'usage-note'));
  const manual=el('section',undefined,'usage-chart-card');manual.append(el('h3','Manuelle Abfragen nach Gerät'),el('p','Geschätzt aus Browser- und Bedienungssignalen.','usage-note'),chart(statistics.devices.map(row=>({label:deviceLabel(row.device),value:row.requests})),'Geräte werden ab dieser Version erfasst. Noch keine als manuell eingeschätzten Abfragen.',true),el('p','Computer Use kann wie menschliche Bedienung erscheinen.','usage-note'));
  charts.append(bots,manual);root.append(charts);

  const section=el('section',undefined,'usage-demand');section.append(el('h3','Welche Termine werden am häufigsten gefragt?'));
  const state={mode:'manual',service:'',channel:'',future:true,free:false,blockedDates};let page=0;
  const tabs=el('div',undefined,'usage-tabs');const content=el('div');const filters=el('div',undefined,'usage-filters');const apiFilters=el('div',undefined,'usage-api-filters');
  const services=[...new Map(statistics.sources.filter(s=>s.audience!=='likely_manual').map(s=>[serviceKey(s),serviceLabel(s)])).entries()];
  const service=select('Dienst / Bot',[['','Alle Dienste'],...services],value=>{state.service=value;page=0;draw();});
  const channel=select('Zugangsweg',[['','API, HTML & weitere'],['api','API'],['agent_html','HTML-Terminseite'],['agent_form','Agentenformular'],['fab','FAB'],['legacy','Frühere Einträge']],value=>{state.channel=value;page=0;draw();});
  apiFilters.append(service.wrapper,channel.wrapper);apiFilters.hidden=true;
  const manualTab=button('Manuelle Nachfrage',()=>{state.mode='manual';page=0;draw();});
  const apiTab=button('Agenten & API',()=>{state.mode='api';page=0;draw();});
  tabs.append(manualTab,apiTab);
  filters.append(check('Nur kommende Termine',true,value=>{state.future=value;page=0;draw();}),check('Nur freie Termine',false,value=>{state.free=value;page=0;draw();}));
  section.append(tabs,apiFilters,filters,content);root.append(section);
  function draw() {
    manualTab.setAttribute('aria-pressed',String(state.mode==='manual'));apiTab.setAttribute('aria-pressed',String(state.mode==='api'));apiFilters.hidden=state.mode==='manual';
    const dates=rankedDates(statistics,state);const maxPage=Math.max(0,Math.ceil(dates.length/10)-1);page=Math.min(page,maxPage);
    const rows=dates.slice(page*10,page*10+10).map((item,index)=>{
      const date=el('div',undefined,'usage-date');date.append(el('strong',day(item.date)),el('small',item.blocked?'Belegt':'Frei'));
      const count=el('strong',number(item.requests),'usage-count');
      return state.mode==='manual'
        ? [page*10+index+1,date,count,number(item.desktop),number(item.mobile),number(item.tablet),number(item.unknownDevice)]
        : [page*10+index+1,date,count,number(item.verified),number(item.reported),number(item.unknown),number(item.limited)];
    });
    content.replaceChildren(table(state.mode==='manual'?['Rang','Wunschtermin','Abfragen ↓','Desktop','Mobil','Tablet','Gerät unklar']:['Rang','Wunschtermin','Abfragen ↓','Netzbeleg','Gemeldet','Unklar','Abgewiesen'],rows,'Termine nach Anzahl der Abfragen'));
    const pagination=el('div',undefined,'usage-pagination');const prev=button('← Zurück',()=>{page--;draw();});const next=button('Weiter →',()=>{page++;draw();});prev.disabled=page===0;next.disabled=page===maxPage;
    pagination.append(el('span',dates.length?`${page*10+1}–${Math.min(page*10+10,dates.length)} von ${number(dates.length)} Terminen`:'0 Termine'),prev,next);content.append(pagination);
    content.append(el('p',state.mode==='manual'?'Nach Anzahl der Abfragen sortiert, keine eindeutigen Personen. Wiederholungen zählen mit; die Rangfolge zeigt beobachtetes Interesse, keine Buchungsprognose.':'Bot-, Client- und unklare Abrufe werden getrennt von manueller Nachfrage gezählt. Breite Kalenderabrufe können diese Rangfolge prägen.','usage-note'));
  }
  draw();
  const details=el('details',undefined,'usage-method');details.append(el('summary','Was wird gezählt?'));
  details.append(el('p',`Zeitraum: ${statistics.windowDays} Tage · ${number(totals.requests)} Server-Abfragen, davon ${number(totals.limited)} am Limit abgewiesen und ${number(totals.errors)} mit Fehler. Eine Anfrage kann bis zu drei Wunschtermine enthalten. Diagramme zählen Anfragen; die Tabelle zählt jeden darin angefragten Termin einmal.`));
  details.append(el('p','Netzbeleg bedeutet: Bot-Kennung und ein passender, veröffentlichter Bot-IP-Bereich stimmen überein. Grundlage ist die vom Hosting-Proxy gemeldete IP; dies bestätigt keine Person und keinen konkreten Auftrag. Nur gemeldete Kennungen, API-Clients und unklare Abrufe bleiben separat.'));
  details.append(el('p',`Manuell ist eine Schätzung aus Formularbedienung, Browserkennung und fehlenden Automatisierungssignalen. Ältere Einträge ohne diese Merkmale werden nicht rückwirkend als Menschen eingestuft.${totals.differentiatedSince?` Neue Erfassung seit ${time(totals.differentiatedSince)}.`:''} Die Speicherung umfasst höchstens 30 Tage, keine Besucherprofile.`));root.append(details);
}

export function renderRecentRequests(root, requests) {
  const rows=(Array.isArray(requests)?requests:[]).slice(0,10).map(item=>{
    const source=el('div',undefined,'usage-recent-source');source.append(el('strong',item.audience==='likely_manual'?deviceLabel(item.device):serviceLabel(item)),el('small',`${channelLabel(item.channel)} · ${audienceLabel(item.audience)}`));
    const outcome=item.responseStatus===200?(item.results||[]).map(result=>result.available?'Frei':'Belegt').join(' / '):item.responseStatus===429?'Limit erreicht':'Fehler';
    return [time(item.requestedAt),source,(item.dates||[]).map(day).join(' · '),outcome];
  });
  root.replaceChildren(table(['Zeit','Herkunft','Wunschtermin','Ergebnis'],rows,'Letzte zehn Terminabfragen'));
}
