import { churchDirectoryData } from '../../data/kirchen';
export const prerender=true;
export function GET(){
  const siteUrl=(import.meta.env.SITE||'https://artbild-fotografie.de').replace(/\/$/,'');
  const data=churchDirectoryData(siteUrl);
  const markdown=[
    '# Kirchenfinder Hamburg – Kontakte und Anmeldung','',`Kanonische Übersicht: ${data.canonicalUrl}`,`Quellen geprüft: ${data.checkedOn}`,data.scope,'',
    'Freie Termine sind nicht bekannt. Diese Informationen erzeugen keine Reservierung. Verbindliche Absprachen erfolgen mit der jeweiligen Gemeinde. Eine Anfrage bei Artbild-Fotografie betrifft ausschließlich fotografische Leistungen.','',
    ...data.churches.flatMap(church=>[
      `## ${church.name}`,`${church.area} · ${church.denomination} · ${church.type}`,`Anleitung: ${church.url}`,'',
      `Erster Kontakt: ${church.contact.role}`,
      ...(church.offerNote?[`Traubeleg (${church.offerEvidence}): ${church.offerNote}`]:[]),
      ...(church.contactNote?[`Aktueller Kontakthinweis: ${church.contactNote}`]:[]),
      ...(church.contact.phone?[`Telefon: ${church.contact.phone}`]:[]),
      ...(church.contact.email?[`E-Mail: ${church.contact.email}`]:[]),
      ...('form' in church.contact && church.contact.form?[`Offizielles Formular: ${church.contact.form}`]:[]),'',
      `Bau und Nutzung: ${church.building.note}`,'',
      ...church.bookingSteps.map((step,i)=>`${i+1}. ${step}`),'',
      `Verbindliche Anmeldung: ${church.bindingRule??'Der genaue verbindliche Bestätigungsschritt ist nicht öffentlich eindeutig beschrieben; bei der Gemeinde erfragen.'}`,'',
      'Voraussetzungen und Unterlagen:',...(church.requirements.length?church.requirements.map(x=>`- ${x}`):['- Noch bei der Gemeinde zu klären.']),'',
      ...(church.schedule?[`Trauzeiten: ${church.schedule}`]:[]),...(church.costs?[`Kosten: ${church.costs}`]:[]),...(church.photography?[`Fotografie: ${church.photography}`]:[]),...(church.localRules?[`Weitere Absprachen: ${church.localRules}`]:[]),'',
      'Offene Fragen:',...church.questionsToClarify.map(x=>`- ${x}`),'','Quellen:',...church.sources.map(s=>`- [${s.title}](${s.url})`),'',
    ]),
    '## Weitere katholische Standorte – keine bestätigten Trauorte','',
    'Diese Orte sind nicht als belegte Trauangebote gezählt. Ein fehlender öffentlicher Traubeleg bedeutet nicht, dass dort keine Hochzeit möglich ist. Schließungen und Umnutzungen sind gesondert bezeichnet.','',
    ...data.additionalResearch.flatMap(entry=>[
      `### ${entry.name} · ${entry.area}`,`Recherche-Status: ${entry.status}`,entry.note,
      `Kontakt: ${entry.contact.role}`,
      ...(entry.contact.phone?[`Telefon: ${entry.contact.phone}`]:[]),
      ...(entry.contact.email?[`E-Mail: ${entry.contact.email}`]:[]),
      'Quellen:',...entry.sources.map(source=>`- [${source.title}](${source.url})`),'',
    ]),
  ].join('\n');
  return new Response(markdown,{headers:{'Content-Type':'text/markdown; charset=utf-8'}});
}
