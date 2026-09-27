import research from './kirchenResearch.json';

export const kirchenStand = research.checkedOn;
export const kirchenStandLabel = '27. September 2026';
export const finderPath = '/kirchenfinder-hamburg/';
export const guidePath = '/kirchliche-trauung-hamburg/';

const portraits: Record<string, { slug: string; introduction: string; highlight: string }> = {
  'alt-rahlstedt': { slug: 'kirche-alt-rahlstedt', introduction: 'Für Eure Hochzeit in der Kirche Alt-Rahlstedt fragt Ihr zuerst im Gemeindebüro nach einem Termin. Die Unterlagen müssen sechs Wochen vor der Trauung vorliegen. Hier findet Ihr den Kontakt und die einzelnen Schritte.', highlight: 'Unterlagen sechs Wochen vorher einreichen' },
  'gertrud-altenwerder': { slug: 'st-gertrud-altenwerder', introduction: 'Ihr möchtet in der Kirche in Altenwerder heiraten? Eure Anfrage geht an die Thomasgemeinde in Hausbruch. Auch Paare aus anderen Gemeinden sind willkommen. Klärt gleich mit, wie Ihr und Eure Gäste die Kirche am Hochzeitstag erreicht.', highlight: 'Anmeldung über die Thomasgemeinde' },
  michel: { slug: 'st-michaelis-michel', introduction: 'Heiraten im Michel: Euren Wunschtermin fragt Ihr im Pfarramt an. Zur Vorbereitung gehört ein verpflichtendes Trauseminar. Unterlagen, Musik und Fotos solltet Ihr früh besprechen – der Michel nennt dafür feste Regeln.', highlight: 'Ein Trauseminar gehört zur Vorbereitung' },
  sinstorf: { slug: 'sinstorfer-kirche', introduction: 'In Sinstorf fragt Ihr Datum und Uhrzeit im Gemeindebüro an. Fest wird die Anmeldung, sobald Euer ausgefülltes Formular dort eingegangen ist. Für Blumen und Küsterarbeit nennt die Gemeinde 60 Euro; zusätzliche Wünsche klärt Ihr gesondert.', highlight: 'Formulareingang macht die Anmeldung verbindlich' },
  flottbek: { slug: 'flottbeker-kirche', introduction: 'In Flottbek könnt Ihr Eure Trauung frühestens ein Jahr vorher anmelden. Nach der Absprache mit dem Kirchenbüro müsst Ihr selbst noch den Kontakt zur Pastorin oder zum Pastor aufnehmen und den Termin bestätigen lassen.', highlight: 'Anmeldung frühestens ein Jahr vorher' },
  nienstedten: { slug: 'nienstedtener-kirche', introduction: 'Für Eure Trauung in Nienstedten stimmt Ihr zuerst den Termin mit dem Kirchenbüro ab. Erst danach folgt die Anmeldung über das offizielle Formular.', highlight: 'Zuerst Termin vereinbaren, dann Formular ausfüllen' },
  'gertrud-uhlenhorst': { slug: 'st-gertrud-uhlenhorst', introduction: 'Für eine Hochzeit in St. Gertrud am Immenhof lasst Ihr zuerst im Gemeindebüro einen Termin vormerken. Verbindlich wird die Anmeldung, wenn das ausgefüllte Formular mit allen Anlagen eingegangen ist.', highlight: 'Formular und Anlagen gehören zur Anmeldung' },
};

const profileHighlights: Record<string, string> = {
  'alt-rahlstedt': 'Unterlagen spätestens sechs Wochen vor der Trauung abgeben.',
  thomas: 'Auch Paare aus anderen Gemeinden können ihre Trauung anfragen.',
  michel: 'Trauseminar und Unterlagen vier Wochen vor der Hochzeit einplanen.',
  obergalster: 'Die gewünschte Kirche beim gemeinsamen Kirchenbüro anfragen.',
  niendorf: 'Paare von außerhalb sollen zunächst ihr eigenes Pfarrteam ansprechen.',
  nienstedten: 'Erst den Termin vereinbaren, anschließend das Formular ausfüllen.',
  blankenese: 'Paare aus anderen Gemeinden bringen ihre eigene Pastorin oder ihren eigenen Pastor mit.',
  eppendorf: 'Zuerst das Kirchenbüro anrufen; das Pfarrteam meldet sich danach.',
  'gertrud-uhlenhorst': 'Verbindliche Anmeldung, sobald Formular und Anlagen eingegangen sind.',
  jacobi: 'Trautermin im Kirchenbüro anfragen. Geplante Bauarbeiten ab 2028 beachten.',
  petri: 'Das Kirchenbüro ist der erste Kontakt für Eure Trauung in der Innenstadt.',
  katharinen: 'Samstags sind Trauungen um 12, 14 oder 16 Uhr vorgesehen.',
  nikolai: 'Die Vorbereitung beginnt mit einem Gespräch im Pfarrteam am Klosterstern.',
  mariendom: 'Eure Anfrage mit Namen, Konfessionen und Datum geht per E-Mail ans Pfarrbüro.',
  othmarschen: 'Termin und persönliche Voraussetzungen mit dem Kirchenbüro besprechen.',
  flottbek: 'Anmeldung frühestens ein Jahr vor Eurer Hochzeit.',
  eimsbuettel: 'Kirche und Pfarrteam gemeinsam anfragen; auch gleichgeschlechtliche Trauungen möglich.',
  harvestehude: 'Trauungen sind samstags um 14 oder 16 Uhr vorgesehen.',
  sinstorf: 'Mit Eingang des ausgefüllten Formulars steht der Termin fest.',
  marmstorf: 'Die Gemeinde sieht zwei Gespräche zur Vorbereitung vor.',
  wellingsbuettel: 'Das Gemeindebüro gibt Euch das aktuelle Informationsblatt zur Trauung.',
  vierlanden: 'Gemeinsame Trauzeiten: samstags um 13.30 oder 15.30 Uhr.',
  finkenwerder: 'Freitag und Samstag sind üblich; andere Tage nach Vereinbarung.',
  moorburg: 'Zuerst die Kirche anfragen, danach den Termin mit dem Pfarrteam abstimmen.',
  andreas: 'Die Terminabsprache beginnt bei Pastor Dr. Kord Schoeler.',
  ottensen: 'Mindestens sechs Wochen vorher anfragen; Gemeindemitglieder haben Vorrang.',
  moorfleet: 'Die Gemeinde beschreibt Trauungen; den genauen Anmeldeweg müsst Ihr dort erfragen.',
};

const regions: Record<string, string> = {
  'Farmsen-Berne':'Nordosten', Poppenbüttel:'Nordosten', Volksdorf:'Nordosten', Bramfeld:'Nordosten', Wandsbek:'Nordosten', Tonndorf:'Nordosten',
  Langenhorn:'Norden', Winterhude:'Innenstadt & Alster', 'Barmbek-Süd':'Innenstadt & Alster', Steilshoop:'Nordosten',
  'St. Pauli':'Westen', 'Altona-Altstadt':'Westen', Osdorf:'Westen', Harburg:'Süderelbe', Wilstorf:'Süderelbe', 'Neugraben-Fischbek':'Süderelbe', Wilhelmsburg:'Süderelbe',
  Rahlstedt:'Nordosten', Bergstedt:'Nordosten', 'Lemsahl-Mellingstedt':'Nordosten', 'Wohldorf-Ohlstedt':'Nordosten', 'Wellingsbüttel':'Nordosten',
  Niendorf:'Norden', Eppendorf:'Norden', Harvestehude:'Innenstadt & Alster', 'Bereich Harvestehude/Rotherbaum':'Innenstadt & Alster', Uhlenhorst:'Innenstadt & Alster', Neustadt:'Innenstadt & Alster', Altstadt:'Innenstadt & Alster', 'St. Georg':'Innenstadt & Alster',
  Eimsbüttel:'Westen', Ottensen:'Westen', Othmarschen:'Westen', 'Groß Flottbek':'Westen', Nienstedten:'Westen', Blankenese:'Westen',
  Moorfleet:'Vier- & Marschlande', Altengamme:'Vier- & Marschlande', Curslack:'Vier- & Marschlande', Kirchwerder:'Vier- & Marschlande', Neuengamme:'Vier- & Marschlande',
  Sinstorf:'Süderelbe', Marmstorf:'Süderelbe', Hausbruch:'Süderelbe', Finkenwerder:'Süderelbe', Moorburg:'Süderelbe', Altenwerder:'Süderelbe', Braak:'Umland',
};

export const churches = research.venues.map(venue => {
  const profile = research.profiles.find(profile => profile.id === venue.profileId)!;
  const portrait = portraits[venue.id];
  const contact = 'contactOverride' in venue && venue.contactOverride ? venue.contactOverride : profile.contact;
  const sourceIds = [...new Set([...venue.sourceIds, ...profile.sourceIds, ...venue.building.sourceIds, ...('sourceIds' in contact ? contact.sourceIds : [])])];
  return {
    ...venue, profile, contact, portrait, region: regions[venue.area] ?? venue.area,
    url: portrait ? `${finderPath}${portrait.slug}/` : `${finderPath}#${venue.id}`,
    sources: sourceIds.map(id => research.sources.find(source => source.id === id)!).filter(Boolean),
    isRestricted: venue.building.status === 'restoration_in_progress',
    hasBuildingNote: venue.building.status !== 'not_individually_verified',
    highlight: 'highlight' in venue ? venue.highlight : profileHighlights[profile.id],
    offerNote: 'offerNote' in venue ? venue.offerNote : null,
    isParishOffer: venue.offerEvidence === 'official_parish_offer',
    isCatholic: venue.denomination !== 'evangelisch-lutherisch',
    buildingLabel: venue.building.status === 'temporary_closure' ? 'Vorübergehend geschlossen' : venue.building.status === 'restoration_in_progress' ? 'Kirchengebäude im Wiederaufbau' : 'Bauhinweis beachten',
  };
});
export type Church = (typeof churches)[number];
export const catholicChurches = churches.filter(church => church.isCatholic);
export const additionalChurchResearch = research.additionalResearch.map(entry => ({...entry, sources: entry.sourceIds.map(id => research.sources.find(source => source.id === id)!)}));
export const directoryScope = `${churches.length} Kirchen und kirchliche Trauorte, davon ${catholicChurches.length} katholische Kirchen. Örtliche Traubelege und allgemeine Pfarreiangebote sind gekennzeichnet. Weitere ${additionalChurchResearch.length} katholische Standorte mit offenem Traunachweis, Schließung oder Umnutzung stehen separat. Kein vollständiges Verzeichnis aller Hamburger Trauorte.`;
export const churchRegions = [...new Set(churches.map(church => church.region))].sort((a,b)=>a.localeCompare(b,'de'));
export const churchPortraits = churches.filter(church => church.portrait);
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g,'')}`;

export function churchCollection(siteUrl: string) {
  return {
    '@type':'ItemList', '@id':`${siteUrl}${finderPath}#verzeichnis`, name:'Kirchen und kirchliche Trauorte in Hamburg und Braak', numberOfItems:churches.length,
    itemListElement:churches.map((church,index)=>({
      '@type':'ListItem', position:index+1, item:{
        '@type':church.venueType==='Kirche'?'Church':'CivicStructure',
        '@id':`${siteUrl}${finderPath}#ort-${church.id}`, name:church.name, url:`${siteUrl}${church.url}`,
        description:church.hasBuildingNote?church.building.note:church.offerNote??`${church.area}. Trauangebot laut offizieller Gemeindequelle; Wunschtermin und individuelle Voraussetzungen bei der Gemeinde bestätigen.`,
      },
    })),
  };
}

export function churchDirectoryData(siteUrl: string) {
  return {
    schemaVersion:2, language:'de', checkedOn:kirchenStand, canonicalUrl:`${siteUrl}${finderPath}`,
    scope:directoryScope,
    evidenceDefinitions:{explicit_official_offer:'Offizielle Quelle zum Trauangebot der Kirche.',official_parish_offer:'Trauanfrage oder Ehevorbereitung auf Pfarreiebene belegt; Nutzung der einzelnen Kirche muss ausdrücklich bestätigt werden.'},
    additionalResearch:additionalChurchResearch,
    availabilityKnown:false, createsReservation:false,
    bookingAuthority:'Die jeweilige Kirchengemeinde. Artbild-Fotografie vermittelt Informationen und bietet fotografische Begleitung an.',
    churches:churches.map(church=>({
      id:church.id, name:church.name, area:church.area, region:church.region, denomination:church.denomination,
      type:church.venueType, scope:church.scope, url:`${siteUrl}${church.url}`, checkedOn:kirchenStand,
      offerEvidence:church.offerEvidence, offerNote:church.offerNote, availability:null, building:church.building,
      contact:church.contact, bookingSteps:church.profile.steps, requirements:church.profile.requirements,
      contactNote:'contactNote' in church.profile?church.profile.contactNote:null,
      bindingRule:church.profile.bindingRule, questionsToClarify:church.profile.unknowns,
      schedule:'schedule' in church.profile?church.profile.schedule:null,
      costs:'costs' in church.profile?church.profile.costs:null,
      photography:'photography' in church.profile?church.profile.photography:null,
      localRules:'localRules' in church.profile?church.profile.localRules:null,
      sources:church.sources.map(({url,title,checkedOn})=>({url,title,checkedOn})),
    })),
  };
}
