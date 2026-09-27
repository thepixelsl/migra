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
  ].join('\n');
  return new Response(markdown,{headers:{'Content-Type':'text/markdown; charset=utf-8'}});
}
