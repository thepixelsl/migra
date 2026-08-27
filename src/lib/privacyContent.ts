import { trackingConfig } from "../config/tracking";

let nextSectionNumber = 8;

const numberedSection = (id: string, title: string, body: string) => {
  const sectionNumber = nextSectionNumber;
  nextSectionNumber += 1;
  return `<h2 id="${id}">${sectionNumber}. ${title}</h2>\n${body}`;
};

const consentSection = numberedSection(
  "cookies-und-einwilligungen",
  "Cookies und Einwilligungen",
  `<p>Für technisch nicht erforderliche Statistik- und Marketingdienste holen wir vor dem Laden des jeweiligen Dienstes Ihre Einwilligung ein. Statistik und Marketing können getrennt gewählt werden. Zusätzlich können Sie Google Tag Manager, Google Analytics 4, Microsoft Clarity und Meta Pixel im Banner einzeln auswählen. Dort können Sie auch die eingesetzten Service-Gruppen, Services und Provider mit ihren jeweiligen Angaben einsehen. Eine Ablehnung hat keinen Einfluss auf die grundlegende Nutzung dieser Website.</p>
<p>Eine von Ihnen getroffene Auswahl wird im Cookie <code>artbild_consent</code> gespeichert, das ausschließlich von dieser Website gesetzt wird. Das Cookie enthält die gewählten Services, eine Versionsangabe und den Zeitpunkt Ihrer Entscheidung. Es enthält weder Kontaktdaten noch Inhalte aus Formularen und hat eine maximale Laufzeit von 180 Tagen.</p>
<p>Die Speicherung dieser Auswahl ist erforderlich, um Ihre Entscheidung zu beachten und nachweisen zu können. Sie beruht auf Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit Art. 7 Abs. 1 DSGVO sowie § 25 Abs. 2 Nr. 2 TDDDG. Über „Datenschutz-Einstellungen“ können Sie Ihre Auswahl jederzeit ändern. Ein Widerruf wirkt für die Zukunft.</p>
<p>Google Tag Manager, Google Analytics 4, Microsoft Clarity und Meta Pixel werden erst nach Ihrer Einwilligung geladen. Der Google Tag Manager ist die übergeordnete technische Instanz für die drei darüber gesteuerten Services. Wenn Sie ihn deaktivieren, werden Google Analytics 4, Microsoft Clarity und Meta Pixel ebenfalls deaktiviert. Einzelheiten finden Sie in den folgenden Abschnitten.</p>`,
);

const tagManagerSection = numberedSection(
  "google-tag-manager",
  "Google Tag Manager",
  `<p>Der Google Tag Manager steuert auf dieser Website Google Analytics 4 sowie die einwilligungsabhängige Auslösung von Microsoft Clarity und Meta Pixel. Anbieter für Personen im Europäischen Wirtschaftsraum ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.</p>
<p>Wir verwenden den grundlegenden Einwilligungsmodus von Google. Vor Ihrer Einwilligung wird der Tag Manager vollständig blockiert; es wird weder das Tag-Manager-Skript abgerufen noch werden Einwilligungssignale oder Messdaten an Google übertragen. Wenn Sie Google Analytics 4, Microsoft Clarity oder Meta Pixel auswählen, wird der Tag Manager als erforderliche übergeordnete Instanz mit ausgewählt. Sie können ihn jederzeit wieder deaktivieren; dadurch werden alle drei abhängigen Services ebenfalls deaktiviert.</p>
<p>Beim Abruf des Tag Managers können insbesondere IP-Adresse, Datum und Uhrzeit sowie Browser-, Betriebssystem- und Geräteangaben als gewöhnliche HTTP-Protokolldaten an Google übermittelt werden. Die von dieser Website bereitgestellten Messereignisse enthalten keine Werte aus Formularfeldern. Google gibt an, die HTTP-Protokolldaten innerhalb von 14 Tagen nach ihrem Eingang zu löschen. Daneben kann Google aggregierte Diagnosedaten zur Stabilität und Ausführungsqualität von Tags verarbeiten; diese enthalten nach Angaben von Google keine IP-Adressen oder personenbezogenen Messkennungen.</p>
<p>Der Tag Manager wird ausschließlich auf Grundlage Ihrer Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO geladen; soweit Informationen auf Ihrem Endgerät gespeichert oder ausgelesen werden, gilt zusätzlich § 25 Abs. 1 TDDDG. Weitere Angaben enthalten Googles Dokumentation zum <a href="https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=de" rel="noopener noreferrer" target="_blank">Einwilligungsmodus</a>, die Hinweise zu <a href="https://support.google.com/tagmanager/answer/9323295?hl=de" rel="noopener noreferrer" target="_blank">Datenschutz und Sicherheit im Tag Manager</a> sowie die <a href="https://policies.google.com/privacy?hl=de" rel="noopener noreferrer" target="_blank">Datenschutzerklärung von Google</a>.</p>`,
);

const googleAnalyticsSection = numberedSection(
  "google-analytics",
  "Google Analytics 4",
  `<p>Google Analytics 4 soll uns zeigen, wie häufig Seiten aufgerufen werden und wie Besucherinnen und Besucher durch das Angebot navigieren. Anbieter für Personen im Europäischen Wirtschaftsraum ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.</p>
<p>Übermittelt werden können insbesondere IP-Adresse, aufgerufene Seiten, Referrer, Zeitpunkt und Dauer von Aufrufen, Interaktionen mit Seitenelementen, ungefähre Region sowie Angaben zu Browser, Betriebssystem und Gerät. Hinzu kommen pseudonyme Nutzer- und Sitzungskennungen. Die von dieser Website erzeugten Messereignisse enthalten keine Namen, E-Mail-Adressen, Nachrichten oder hochgeladenen Dateien aus unseren Formularen.</p>
<p>Google Analytics 4 wird erst nach Ihrer Einwilligung in den Service „Google Analytics 4“ und in den Google Tag Manager als übergeordnete Instanz geladen. Ohne diese Einwilligung werden keine Analytics-Messsignale an Google übertragen. Nach Ihrer Einwilligung wird <code>analytics_storage</code> freigegeben und die cookie-basierte Statistikverarbeitung aktiviert. Für die Verarbeitung gelten Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG. Sie können die Einwilligung jederzeit über „Datenschutz-Einstellungen“ für die Zukunft widerrufen.</p>
<p>Google nennt für die mit <code>_ga</code> beginnenden Analytics-Cookies standardmäßig eine Ablaufzeit von zwei Jahren; diese Frist kann verkürzt werden. Die für diese Website festgelegte Aufbewahrungsfrist für Nutzer- und Ereignisdaten beträgt ${trackingConfig.ga4DataRetentionMonths} Monate. Nach Ablauf löscht Google die betroffenen Daten im monatlichen Verfahren. Aggregierte Standardberichte sind nach Angaben von Google von dieser Frist nicht erfasst. Weitere Informationen finden Sie in den <a href="https://support.google.com/analytics/answer/7667196?hl=de" rel="noopener noreferrer" target="_blank">Hinweisen zur Datenaufbewahrung</a> und der <a href="https://policies.google.com/privacy?hl=de" rel="noopener noreferrer" target="_blank">Datenschutzerklärung von Google</a>.</p>`,
);

const metaTrackingSection = numberedSection(
  "meta-pixel",
  "Meta Pixel",
  `<p>Das Meta Pixel soll die Reichweite und Wirksamkeit unserer Werbung auf Angeboten von Meta messen sowie die Bildung von Zielgruppen und Remarketing ermöglichen. Anbieter für Personen im Europäischen Wirtschaftsraum ist Meta Platforms Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland.</p>
<p>Übermittelt werden können insbesondere IP-Adresse, aufgerufene Seite, Referrer, Zeitpunkt des Aufrufs, Browser- und Geräteangaben, Cookie-Kennungen sowie von uns festgelegte Ereignisse wie der Aufruf einer Kontakt-, Anfrage- oder Preisseite. Die von unserem lokalen Messskript übergebenen Ereignisparameter enthalten keine Inhalte aus Kontakt- oder Anfrageformularen und keine hochgeladenen Dateien.</p>
<p>Das Meta Pixel ist im Google Tag Manager eingerichtet, dort aber zusätzlich an die Einwilligung in den Service „Meta Pixel“ gebunden. Es wird ausschließlich nach dieser Einwilligung geladen. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG. Sie können die Einwilligung jederzeit über „Datenschutz-Einstellungen“ für die Zukunft widerrufen.</p>
<p>Soweit Meta die Ereignisdaten für Zielgruppen-, Werbe- oder Remarketingzwecke zu eigenen Zwecken verarbeitet, sind wir und Meta Platforms Ireland Limited für die Erhebung auf dieser Website und die anschließende Übermittlung gemeinsam verantwortlich. Die Aufteilung der Pflichten für diesen Verarbeitungsschritt beschreibt das <a href="https://www.facebook.com/legal/controller_addendum" rel="noopener noreferrer" target="_blank">Controller Addendum von Meta</a>. Betroffenenrechte können sowohl bei uns als auch bei Meta geltend gemacht werden. Für die weitere Verarbeitung bei Meta sowie die dazugehörigen Informations- und Betroffenenrechte ist Meta verantwortlich.</p>
<p>Die Cookies <code>_fbp</code> und <code>_fbc</code> haben nach den Angaben von Meta eine Laufzeit von bis zu 90 Tagen. Die Bedingungen für Meta-Unternehmenstools sehen für übermittelte Ereignisdaten eine Speicherdauer von höchstens zwei Jahren vor. Aus diesen Daten gebildete Zielgruppen bleiben bestehen, bis sie im Meta-Konto gelöscht werden. Weitere Angaben finden Sie in den <a href="https://www.facebook.com/legal/terms/businesstools" rel="noopener noreferrer" target="_blank">Bedingungen für Meta-Unternehmenstools</a>, der <a href="https://www.facebook.com/privacy/policies/cookies/" rel="noopener noreferrer" target="_blank">Cookie-Richtlinie</a> und der <a href="https://www.facebook.com/privacy/policy/" rel="noopener noreferrer" target="_blank">Datenschutzrichtlinie von Meta</a>.</p>`,
);

const claritySection = numberedSection(
  "microsoft-clarity",
  "Microsoft Clarity",
  `<p>Microsoft Clarity soll uns anhand von Heatmaps und nachgebildeten Nutzungssitzungen helfen, die Bedienbarkeit dieser Website zu beurteilen. Dabei handelt es sich nicht um eine Videoaufnahme Ihres Bildschirms, sondern um eine technische Rekonstruktion von Seitenelementen und Interaktionen. Anbieter für Personen im Europäischen Wirtschaftsraum ist Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland.</p>
<p>Übermittelt werden können insbesondere IP-Adresse, aufgerufene Seiten, Referrer, Datum und Uhrzeit, Klicks, Scrollbewegungen, Mausbewegungen, Fenstergröße, technische Fehler sowie Angaben zu Browser, Betriebssystem und Gerät. Clarity verarbeitet außerdem Seitenstruktur, Layout, Attribute und Inhalte nicht ausgeblendeter Seitenbereiche, soweit dies für die technische Rekonstruktion erforderlich ist. Die Kontakt-, Anfrage- und Terminformulare dieser Website sind als maskierte Bereiche gekennzeichnet; dort eingegebene Inhalte werden dadurch nicht im Klartext für die Sitzungsrekonstruktion erfasst.</p>
<p>Clarity ist im Google Tag Manager eingerichtet, dort aber zusätzlich an die Einwilligung in den Service „Microsoft Clarity“ gebunden. Es wird ausschließlich nach dieser Einwilligung geladen und erhält über die Consent API V2 ein freigegebenes Statistik- und ein abgelehntes Werbespeichersignal. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG. Sie können die Einwilligung jederzeit über „Datenschutz-Einstellungen“ für die Zukunft widerrufen. Microsoft Advertising (ehemals Bing Ads) und das UET-Tracking sind nicht Bestandteil der hier beschriebenen Clarity-Nutzung.</p>
<p>Microsoft gibt derzeit folgende Speicherdauern an: Wiedergabedaten werden 30 Tage gespeichert; Klick- und Heatmap-Daten sowie markierte oder favorisierte Sitzungen werden neun Monate gespeichert. Weitere Informationen finden Sie in der <a href="https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention" rel="noopener noreferrer" target="_blank">Clarity-Dokumentation zur Datenaufbewahrung</a> und der <a href="https://www.microsoft.com/de-de/privacy/privacystatement" rel="noopener noreferrer" target="_blank">Datenschutzerklärung von Microsoft</a>.</p>`,
);

const thirdCountrySection = numberedSection(
  "drittlanduebermittlungen-tracking",
  "Drittlandübermittlungen bei Statistik- und Marketingdiensten",
  `<p>Bei Google, Meta und Microsoft kann nicht ausgeschlossen werden, dass Daten an verbundene Unternehmen oder andere Empfänger außerhalb der Europäischen Union und des Europäischen Wirtschaftsraums, insbesondere in den USA, übermittelt oder dort verarbeitet werden.</p>
<p>Google LLC, Meta Platforms, Inc. und Microsoft Corporation sind nach den derzeitigen Angaben der Anbieter für das EU-US Data Privacy Framework zertifiziert. Für von der jeweiligen Zertifizierung erfasste Datenübermittlungen in die USA gilt deshalb der Angemessenheitsbeschluss der Europäischen Kommission. Die Anbieter informieren über ihre Zertifizierungen und Übermittlungsgrundlagen bei <a href="https://policies.google.com/privacy/frameworks?hl=de" rel="noopener noreferrer" target="_blank">Google</a>, <a href="https://www.facebook.com/privacy/policies/data_privacy_framework/" rel="noopener noreferrer" target="_blank">Meta</a> und <a href="https://www.microsoft.com/de-de/privacy/privacystatement" rel="noopener noreferrer" target="_blank">Microsoft</a>. Der aktuelle Status kann zusätzlich in der <a href="https://www.dataprivacyframework.gov/list" rel="noopener noreferrer" target="_blank">offiziellen Data-Privacy-Framework-Liste</a> geprüft werden.</p>
<p>Für Übermittlungen, die nicht von einem Angemessenheitsbeschluss erfasst sind, beschreiben die Anbieter weitere Schutzinstrumente. Google verweist in seinen <a href="https://policies.google.com/privacy/frameworks?hl=de" rel="noopener noreferrer" target="_blank">Rahmenbedingungen für Datenübermittlungen</a> auf EU-Standardvertragsklauseln. Meta veröffentlicht ein <a href="https://www.facebook.com/legal/terms/Privacy/GDTA" rel="noopener noreferrer" target="_blank">Global Data Transfer Addendum</a>. Microsoft erläutert die zwischen Microsoft Ireland Operations Limited und Microsoft Corporation verwendeten Standardvertragsklauseln in den <a href="https://learn.microsoft.com/en-us/clarity/faq" rel="noopener noreferrer" target="_blank">Datenschutzhinweisen zu Clarity</a>. Welche Übermittlungsgrundlage im Einzelfall greift, richtet sich nach Empfänger, Zielstaat und den jeweils geltenden Anbieterbedingungen.</p>
<p>Trotz solcher Instrumente kann bei einer Verarbeitung in einem Drittland ein Risiko bestehen, dass Behörden nach dem dortigen Recht auf Daten zugreifen und europäische Betroffenenrechte nicht in gleicher Weise durchgesetzt werden können.</p>`,
);

const picDropSection = numberedSection(
  "picdrop",
  "Kundengalerien über PicDrop",
  `<p>Für die Bereitstellung und Abstimmung von Kundengalerien verwenden wir PicDrop. Anbieter ist die PicDrop GmbH, Am Kupfergraben 4/4a, 10117 Berlin. Beim Aufruf einer separat bereitgestellten PicDrop-Galerie können insbesondere Bilder, Galerie- und Zugriffsdaten, IP-Adresse, Zeitpunkt, Referrer, Browserangaben sowie von Ihnen vorgenommene Auswahlen verarbeitet werden.</p>
<p>Die Verarbeitung erfolgt zur Vertragserfüllung nach Art. 6 Abs. 1 lit. b DSGVO und, soweit erforderlich, aufgrund unseres berechtigten Interesses an einer sicheren und übersichtlichen Bildauslieferung nach Art. 6 Abs. 1 lit. f DSGVO. PicDrop gibt für technische Protokolldaten eine Löschung nach 90 Tagen an. Die Bereitstellungsdauer einer Kundengalerie richtet sich nach der jeweiligen Vereinbarung; anschließend werden die Daten gelöscht, soweit keine gesetzlichen Pflichten oder berechtigten Gründe für eine weitere Aufbewahrung bestehen. Weitere Informationen finden Sie in der <a href="https://www.picdrop.com/web/de/privacy" rel="noopener noreferrer" target="_blank">Datenschutzerklärung von PicDrop</a>.</p>`,
);

const externalLinksSection = numberedSection(
  "externe-links",
  "Externe Links und soziale Netzwerke",
  `<p>Auf der Website befinden sich Links zu externen Angeboten, insbesondere Instagram, Facebook und Pinterest. Beim bloßen Anzeigen unserer Seiten wird durch diese Links keine Verbindung zum jeweiligen Netzwerk hergestellt. Erst wenn Sie einen externen Link öffnen, verarbeitet der jeweilige Anbieter den Aufruf nach seinen eigenen Datenschutzbestimmungen. Dies gilt ebenso für Schaltflächen, mit denen Inhalte bei einem sozialen Netzwerk geteilt werden.</p>`,
);

const storageSection = numberedSection(
  "speicherdauer",
  "Speicherdauer",
  `<p>Für jede Verarbeitung gilt: Entfällt der Zweck, werden die betreffenden personenbezogenen Daten gelöscht oder anonymisiert. Eine weitere Aufbewahrung erfolgt nur, wenn gesetzliche Fristen einzuhalten sind, Daten für die Geltendmachung oder Abwehr von Ansprüchen benötigt werden oder ein anderer gesetzlich zulässiger Grund fortbesteht.</p>`,
);

const rightsSection = numberedSection(
  "rechte",
  "Ihre Rechte",
  `<p>Sie haben im Rahmen der gesetzlichen Voraussetzungen insbesondere das Recht auf Auskunft nach Art. 15 DSGVO, Berichtigung nach Art. 16 DSGVO, Löschung nach Art. 17 DSGVO, Einschränkung der Verarbeitung nach Art. 18 DSGVO und Datenübertragbarkeit nach Art. 20 DSGVO. Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen.</p>
<p>Durch den Widerruf wird die Rechtmäßigkeit der Verarbeitung bis zum Zeitpunkt des Widerrufs nicht berührt. Sie können einer Verarbeitung, die auf Art. 6 Abs. 1 lit. f DSGVO beruht, aus Gründen Ihrer besonderen Situation nach Art. 21 DSGVO widersprechen. Gegen die Verarbeitung für Zwecke der Direktwerbung einschließlich eines damit verbundenen Profilings können Sie jederzeit widersprechen. Wenden Sie sich dazu an <a href="mailto:info@artbild-fotografie.de">info@artbild-fotografie.de</a>.</p>`,
);

const complaintSection = numberedSection(
  "beschwerderecht",
  "Beschwerderecht",
  `<p>Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für Hamburg ist dies der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit. Aktuelle Kontaktdaten finden Sie unter <a href="https://datenschutz-hamburg.de/" rel="noopener noreferrer" target="_blank">datenschutz-hamburg.de</a>.</p>`,
);

const privacyContent = `
<p><strong>Stand: 27. August 2026</strong></p>
<p>Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten beim Besuch dieser Website und bei der Kontaktaufnahme verarbeitet werden.</p>

<h2 id="verantwortlicher">1. Verantwortlicher</h2>
<p>
  Artbild-Fotografie<br>
  York Augustin<br>
  Rahlstedter Bahnhofstraße 27<br>
  22143 Hamburg<br>
  Deutschland
</p>
<p>E-Mail: <a href="mailto:info@artbild-fotografie.de">info@artbild-fotografie.de</a></p>
<p>Weitere Angaben finden Sie im <a href="/impressum/">Impressum</a>.</p>

<h2 id="bunny-hosting">2. Webhosting bei bunny.net</h2>
<p>Für das Webhosting dieser Website nutzen wir bunny.net. Anbieter ist BunnyWay d.o.o. mit Sitz in der Dunajska cesta 165, 1000 Ljubljana, Slowenien.</p>
<p>Der von uns gewählte Standort des Webservers ist Frankfurt am Main, Deutschland. Auch die Datenbank dieser Website wird nach unserer Konfiguration ausschließlich in Frankfurt am Main gespeichert. Diese Standortangabe bezieht sich auf den Webserver und die Website-Datenbank.</p>
<p>Beim Besuch der Website werden insbesondere Ihre IP-Adresse, Datum und Uhrzeit des Aufrufs, die aufgerufene Seite oder Datei, die zuvor besuchte Seite (Referrer) sowie Angaben zu Browser, Betriebssystem und verwendetem Gerät an bunny.net übermittelt.</p>
<p>Die Verarbeitung erfolgt, um die Website bereitzustellen, ihre Stabilität und Sicherheit zu gewährleisten sowie Missbrauch und technische Fehler zu erkennen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt in einem sicheren und zuverlässigen Internetangebot.</p>
<p>Die Daten werden nur so lange gespeichert, wie dies für die genannten Zwecke erforderlich ist, sofern keine gesetzlichen Pflichten oder die Bearbeitung eines konkreten Sicherheitsvorfalls eine längere Speicherung erfordern. Weitere Informationen finden Sie in der <a href="https://bunny.net/privacy/" rel="noopener noreferrer" target="_blank">Datenschutzrichtlinie von bunny.net</a>.</p>

<h2 id="kontaktformular">3. Kontaktformular</h2>
<p>Wenn Sie das Kontaktformular verwenden, verarbeiten wir die von Ihnen eingegebenen Angaben. Pflichtangaben sind Anfrageart, Name, E-Mail-Adresse, Veranstaltungsort und die Antwort auf die Sicherheitsfrage. Das Wunschdatum ist außer bei TFP-Anfragen ebenfalls erforderlich. Nachricht und bis zu drei Bilddateien bei einer TFP-Anfrage sind freiwillig. Es besteht keine gesetzliche Pflicht, diese Daten bereitzustellen. Ohne die erforderlichen Angaben kann das Formular nicht versendet und die Anfrage nicht bearbeitet werden.</p>
<p>Zusätzlich werden Zeitpunkt und Quellseite der Anfrage, die Antwort auf die Sicherheitsfrage, Anzahl und Dateinamen der Anhänge sowie eine aus der IP-Adresse gebildete pseudonymisierte Kennung verarbeitet. Die Inhalte hochgeladener Dateien werden für den Versand verarbeitet und als E-Mail-Anhang weitergegeben; sie werden nicht zusammen mit dem Formulardatensatz gespeichert.</p>
<p>Wir verwenden diese Daten, um Ihre Anfrage zu beantworten, ein gewünschtes Vertragsverhältnis vorzubereiten und das Formular gegen automatisierten Missbrauch zu schützen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit Ihre Anfrage auf einen Vertrag oder vorvertragliche Maßnahmen gerichtet ist. Im Übrigen erfolgt die Verarbeitung nach Art. 6 Abs. 1 lit. f DSGVO aufgrund unseres Interesses an einer zuverlässigen und missbrauchsgeschützten Kommunikation.</p>
<p>Die Formulardaten werden im Rahmen des Webhostings in Frankfurt am Main vorübergehend gespeichert und an unser E-Mail-Postfach bei STRATO übermittelt. Die pseudonymisierte IP-Kennung dient ausschließlich der Begrenzung wiederholter Einsendungen und wird spätestens nach 30 Minuten entfernt. Sobald die Speicherdauer von 30 Tagen überschritten ist, wird die technische Datenbankkopie der Anfrage in einem regelmäßigen Bereinigungslauf automatisch gelöscht.</p>
<p>Die an STRATO übermittelte Korrespondenz speichern wir so lange, wie dies für die Bearbeitung der Anfrage, ein mögliches Vertragsverhältnis, die Erfüllung gesetzlicher Aufbewahrungspflichten oder die Geltendmachung beziehungsweise Abwehr von Ansprüchen erforderlich ist.</p>

<h2 id="email-versand">4. E-Mail-Kommunikation</h2>
<p>Für die Verarbeitung und Speicherung von E-Mails nutzen wir STRATO. Anbieter ist die STRATO GmbH, Otto-Ostrowski-Straße 7, 10249 Berlin. Beim Versand einer Kontaktanfrage werden die Formulardaten und etwaige Anhänge an unser dort geführtes E-Mail-Postfach übermittelt.</p>
<p>Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir insbesondere Ihre E-Mail-Adresse, den Inhalt Ihrer Nachricht, etwaige Anhänge sowie die bei der E-Mail-Kommunikation anfallenden Verbindungs- und Zeitdaten. Bei einer Kontaktaufnahme per Telefon verarbeiten wir die von Ihnen mitgeteilten Daten zur Bearbeitung Ihres Anliegens. Es gelten dieselben Rechtsgrundlagen wie für das Kontaktformular. Weitere Informationen enthält die <a href="https://www.strato.de/datenschutz/" rel="noopener noreferrer" target="_blank">Datenschutzerklärung von STRATO</a>.</p>

<h2 id="whatsapp">5. Kontakt über WhatsApp</h2>
<p>Die Website enthält Links, über die Sie freiwillig einen WhatsApp-Chat mit uns beginnen können. Beim bloßen Anzeigen der Website wird keine Verbindung zu WhatsApp hergestellt. Erst wenn Sie den Link öffnen, werden Sie zu WhatsApp weitergeleitet. Dabei wird auch der im jeweiligen Link vorgegebene Nachrichtentext an WhatsApp übermittelt; Sie können ihn vor dem Absenden der Nachricht verändern.</p>
<p>Wenn Sie uns über WhatsApp kontaktieren, verarbeiten wir insbesondere Ihre Telefonnummer, Ihren Profilnamen, den Nachrichteninhalt, übermittelte Dateien sowie Kommunikationszeitpunkte zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit es um einen Vertrag oder vorvertragliche Maßnahmen geht, ansonsten Art. 6 Abs. 1 lit. f DSGVO aufgrund unseres Interesses an einer von Ihnen gewählten, direkten Kommunikation.</p>
<p>Anbieter für die Region Europa ist WhatsApp Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland. WhatsApp verarbeitet zusätzlich eigene Konto-, Geräte-, Verbindungs- und Nutzungsdaten und kann Informationen weltweit übermitteln.</p>
<p>Nach der aktuellen Datenschutzrichtlinie von WhatsApp sind WhatsApp LLC und Meta Platforms, Inc. für das EU-US Data Privacy Framework zertifiziert. Für Übermittlungen, die nicht von einem Angemessenheitsbeschluss erfasst sind, gibt WhatsApp den Einsatz der von der Europäischen Kommission genehmigten Standardvertragsklauseln an. Einzelheiten finden Sie in der <a href="https://www.whatsapp.com/legal/privacy-policy-eea?lang=de_DE" rel="noopener noreferrer" target="_blank">Datenschutzrichtlinie von WhatsApp</a>.</p>

<h2 id="terminverfuegbarkeit">6. Terminverfügbarkeit</h2>
<p>Wenn Sie die öffentliche Terminabfrage nutzen, wird das von Ihnen ausgewählte Datum an den Server dieser Website übermittelt und dort mit bereits gesperrten Daten abgeglichen. Für diese Abfrage sind weder Ihr Name noch Ihre Kontaktdaten erforderlich.</p>

<h2 id="terminabfrage-buchungsagenten">7. Begrenzte Terminabfrage für Buchungsagenten</h2>
<p>Auf der Seite „Für Buchungsagenten“ können pro Anfrage ein bis drei konkrete Wunschdaten an den Server dieser Website übermittelt und mit bereits gesperrten Daten abgeglichen werden. Die zurückgegebene Auskunft ist unverbindlich und bewirkt weder eine Reservierung noch eine automatisierte Buchungsentscheidung.</p>
<p>Um die Schnittstelle auf höchstens zwei erfolgreiche Abfragen innerhalb von 24 Stunden zu begrenzen, wird aus der beim Zugriff technisch übermittelten IP-Adresse unmittelbar mit einem geheimen Zusatz eine pseudonyme Kurzzeitkennung gebildet. Die Anwendung speichert für diese Begrenzung weder die vollständige IP-Adresse noch den User-Agent oder die abgefragten Wunschdaten. Gespeichert werden nur eine aus der Kurzzeitkennung abgeleitete technische Zuordnung und die Zeitpunkte erfolgreicher Abfragen.</p>
<p>Diese Daten dienen ausschließlich dazu, automatisierte Massenabfragen und eine Umgehung der Abfragegrenze zu verhindern sowie die Verfügbarkeit der Schnittstelle zu sichern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im Schutz des Kalenders und der technischen Infrastruktur vor missbräuchlicher Nutzung. Einträge, deren 24-Stunden-Fenster abgelaufen ist, werden im nächsten regelmäßigen Bereinigungslauf gelöscht.</p>

${consentSection}
${tagManagerSection}
${googleAnalyticsSection}
${metaTrackingSection}
${claritySection}
${thirdCountrySection}
${picDropSection}
${externalLinksSection}
${storageSection}
${rightsSection}
${complaintSection}
`;

const privacyPaths = new Set([
  "/datenschutz/",
  "/datenschutzerklaerung/",
]);

export const modernizePrivacyContent = (path: string, sourceHtml: string) =>
  privacyPaths.has(path) ? privacyContent : sourceHtml;
