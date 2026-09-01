# Consent, Google Analytics, Microsoft Clarity und Meta Pixel

## Architektur

Die Website trennt Einwilligung, Ereignisse und Anbieter:

1. `TrackingHead.astro` liest eine bestehende Einwilligung und setzt vor allen
   Tags die Google-Consent-Standardwerte auf `denied`. GTM wird nur nach einer
   aktuellen oder gespeicherten Einwilligung für mindestens einen optionalen
   Service geladen.
2. `ConsentBanner.astro` verwaltet die Kategorien `necessary`, `analytics` und
   `marketing`.
3. `TrackingDataLayer.astro` erzeugt ausschließlich strukturierte Ereignisse
   ohne Formularinhalte oder angefragte Termine.
4. Google Analytics wird über den Google Tag Manager konfiguriert. Vor einer
   Einwilligung werden weder GTM noch das Google-Tag geladen; dadurch entstehen
   auch keine cookielosen Google-Signale.
5. Microsoft Clarity liegt im GTM und benötigt zusätzlich
   `analytics_storage=granted` sowie ein freigegebenes Statistikereignis.
6. Das Meta Pixel liegt im GTM und benötigt zusätzlich `ad_storage=granted`
   sowie ein freigegebenes Marketingereignis.

Die Anbieterkennungen sind öffentliche Build-Konfiguration. Sie sind keine
Geheimnisse, sollen aber nicht im Quellcode verteilt werden.

## Umgebungen

Die Vorlage steht in `.env.example`.

| Wert | Verhalten |
| --- | --- |
| `disabled` | Kein Banner und keine Drittanbieter |
| `staging` | Banner und Anbieter nur bei vollständigen IDs und erlaubtem Host |
| `test` | Ausschließlich für künstliche Test-IDs |
| `production` | Echte GTM- und GA4-IDs sind verpflichtend; Platzhalter brechen den Build ab |

Der im Repository hinterlegte Standard ist die produktive `.de`-Konfiguration.
Eine Build-Umgebung kann die öffentlichen Werte weiterhin überschreiben oder
das Tracking mit `disabled` vollständig abschalten.

`PUBLIC_TRACKING_ALLOWED_HOSTS` ist eine zweite Sicherung im Browser. Ein
Production-Build lädt seine Anbieter nur auf einem explizit freigegebenen
Host. Die in `astro.config.mjs` konfigurierte kanonische URL ist ausdrücklich
kein Tracking-Schalter.

## Umschaltung auf die .de-Domain

Vor dem Livegang werden in der Build-Umgebung gesetzt:

```text
PUBLIC_TRACKING_ENV=production
PUBLIC_TRACKING_ALLOWED_HOSTS=artbild-fotografie.de,www.artbild-fotografie.de
PUBLIC_GTM_CONTAINER_ID=GTM-5TM37JC
PUBLIC_GA4_MEASUREMENT_ID=G-TSWGFD1YKF
PUBLIC_GA4_DATA_RETENTION_MONTHS=14
PUBLIC_CONSENT_VERSION=2026-09-02.1
```

Diese Werte müssen dem Astro-Build zur Verfügung stehen. Ein Eintrag unter
Wrangler `[vars]` oder in `.dev.vars` reicht nicht aus, weil die Website
statisch gebaut wird.

`PUBLIC_GA4_DATA_RETENTION_MONTHS` dokumentiert die in GA4 geprüfte
Aufbewahrungsdauer für Nutzer- und Ereignisdaten. Der Wert darf nur `2` oder
`14` betragen. Der Production-Standard von `14` Monaten wurde mit der
GA4-Property abgeglichen. Die Build-Variable ändert die Property nicht selbst.

Der Production-Build schlägt fehl, wenn GTM- oder GA4-Kennung fehlen, ein Format nicht
stimmt oder ein erkennbarer Testwert verwendet wird. Die Vorabprüfung liest
auch `.env` und `.env.production`; tatsächlich gesetzte Build-Variablen haben
Vorrang. Die Aktivierung erfolgt dadurch ohne Änderung an Komponenten oder
Seitentemplates.

Notabschaltung:

```text
PUBLIC_TRACKING_ENV=disabled
```

Anschließend muss neu gebaut und deployt werden.

## Google Tag Manager

Der Google Tag Manager wird auf erlaubten öffentlichen Hosts nur im Basic Mode
und erst nach einer Einwilligung für mindestens einen optionalen Service
geladen. Vorher setzt die Website `analytics_storage`, `ad_storage`,
`ad_user_data` und `ad_personalization` auf `denied`. Es werden keine
cookielosen Google-Signale gesendet. Verhaltens-, Sichtbarkeits- und
Formularereignisse der Website werden ohne Statistik-Einwilligung weder
vorgemerkt noch später nachgesendet.

Im Container werden mindestens folgende Data-Layer-Variablen angelegt:

```text
google_analytics_id
tracking_environment
consent_analytics
consent_marketing
page_id
page_type
section_id
content_topic
user_intent
journey_stage
cta_id
cta_type
position
resource_id
resource_type
content_format
form_id
form_type
result
interaction_action
slider_id
item_index
faq_id
```

Empfohlene Tags:

1. Google Tag mit `{{google_analytics_id}}`.
2. Auslösung auf allen öffentlichen Seiten.
3. Keine zusätzlichen Consent-Checks für Google Tags, da deren eingebaute
   Consent-Prüfungen verwendet werden.
4. Die lokalen Ereignisse werden nach Statistik-Einwilligung über
   `gtag("event", …)` an das im Container konfigurierte Google-Tag übergeben.
5. Meta-Basistags benötigen `ad_storage` als zusätzlichen Consent-Check und den
   Trigger `Marketing-Einwilligung erteilt`.
6. Clarity benötigt `analytics_storage` als zusätzlichen Consent-Check und den
   Trigger `Statistik-Einwilligung erteilt`. Das Tag übergibt Consent API V2.
7. Veraltete Universal-Analytics-, Optimize-, Google-Ads- und
   Contact-Form-7-Tags bleiben pausiert.

Vor Veröffentlichung muss der Container im Preview-Modus und anschließend mit
Tag Assistant geprüft werden.

## Ereignisvertrag

| Data-Layer-Ereignis | Bedeutung | Empfohlene GA4-Zuordnung |
| --- | --- | --- |
| `section_view` | Inhaltsbereich wurde tatsächlich sichtbar | benutzerdefiniert |
| `cta_click` | Interner CTA oder Navigationsaktion | benutzerdefiniert |
| `view_pricing` | Preise- oder Paketübersicht wurde gezielt geöffnet | benutzerdefiniert/Meta `ViewContent` |
| `contact_click` | E-Mail, Telefon, WhatsApp oder Kontaktweg | `contact`/benutzerdefiniert |
| `external_resource_click` | Externe Website oder Social-Profil | `click` |
| `gallery_interaction` | Galerie geöffnet, geblättert oder geschlossen | benutzerdefiniert |
| `content_slider_interaction` | Slider mit Aktion und Index verwendet | benutzerdefiniert |
| `faq_open` | FAQ wurde tatsächlich geöffnet | benutzerdefiniert |
| `form_start` | Erste Interaktion mit einem Formular | `form_start` |
| `form_submit_attempt` | Gültiger Sendeversuch, noch keine Conversion | benutzerdefiniert |
| `form_success` | Server hat die Anfrage bestätigt | `generate_lead` |
| `form_error` | Anfrage ist technisch gescheitert | benutzerdefiniert |
| `availability_check_result` | Ergebnis ohne Übertragung des Datums | benutzerdefiniert |

Nur

```text
event = form_success
form_type = contact_request
```

darf als Lead beziehungsweise primäre Conversion gewertet werden. Das Meta
Pixel bildet ausschließlich diesen bestätigten Erfolg auf `Lead` ab.

## Kennzeichnung neuer Elemente

Gestaltungsklassen und sichtbarer Text dürfen nicht als dauerhafte
Tracking-Selektoren verwendet werden. Relevante Elemente erhalten stabile
`data-*`-Attribute:

```html
<a
  href="/kontakt/"
  data-track-event="cta_click"
  data-cta-id="home_hero_anfrage"
  data-cta-type="primary"
  data-section-id="home_hero"
  data-content-topic="hochzeit"
  data-user-intent="anfrage_starten"
  data-journey-stage="conversion"
  data-position="hero"
>
  Termin anfragen
</a>
```

Regeln:

- nur Kleinbuchstaben, Zahlen und Unterstriche;
- keine Namen, E-Mail-Adressen, Telefonnummern, Nachrichten oder Termine;
- IDs bleiben auch bei Text- oder Designänderungen stabil;
- Position und Bedeutung werden getrennt beschrieben;
- `journey_stage` verwendet nur `awareness`, `consideration`, `decision`,
  `conversion`, `retention` oder bei globaler Navigation `cross_journey`;
- ein neuer Conversion-Event benötigt immer einen bestätigten fachlichen
  Erfolg, nicht nur einen Klick.

Geschäftlich relevante Ziel-Links werden zusätzlich zentral abgesichert. Links
zu Preisen, Kontakt, sicherem Kontakt, Telefon, E-Mail oder WhatsApp erhalten
beim Seitenstart eine stabile, seitenspezifische Kennung, falls ein älteres
Template noch keine expliziten `data-*`-Attribute enthält. Die Kennung wird aus
Zieltyp, Seitenbereich und Auftretensnummer gebildet; sichtbarer Text,
Telefonnummern und E-Mail-Adressen werden nicht übernommen. Preislinks werden
als `view_pricing`, Kontaktwege als `contact_click` normalisiert.

## Microsoft Clarity

Clarity wird über den GTM-Container geladen. Es gehört zur Kategorie Statistik
und startet erst nach `analytics: true`. Formulare tragen
`data-clarity-mask`, damit ihre sichtbaren Inhalte zusätzlich zur
standardmäßigen Clarity-Maskierung geschützt sind.

Beim Widerruf erhält Clarity ein abgelehntes Consent-V2-Signal. Die lokal
erreichbaren Cookies `_clck` und `_clsk` werden entfernt.

## Consent-Verhalten

Die lokalen Google-Consent-Standardwerte lauten:

```text
analytics_storage=denied
ad_storage=denied
ad_user_data=denied
ad_personalization=denied
security_storage=granted
```

Zusätzlich sind `ads_data_redaction=true` und `url_passthrough=false` gesetzt.
GTM und das Google-Tag werden vor einer passenden Einwilligung vollständig
blockiert. Microsoft Clarity und Meta bleiben ebenfalls bis zur jeweils
passenden Einwilligung vollständig blockiert. GTM ist eine interne technische
Abhängigkeit und wird im Banner nicht als eigene Auswahl präsentiert.

Der First-Party-Cookie `artbild_consent` speichert Auswahl, Version und
Zeitpunkt für sechs Monate. Eine Änderung von `PUBLIC_CONSENT_VERSION`
invalidiert alte Entscheidungen und zeigt den Banner erneut.

## Abnahme vor Production

1. Frisches Browserprofil: keine Anfrage an GTM, Google Analytics, Microsoft
   Clarity oder Meta.
2. „Nur notwendige“: keine GA-, Clarity-, FBP- oder FBC-Cookies.
3. Nur Statistik: GTM/GA4 und Clarity aktiv, Meta weiterhin vollständig blockiert.
4. Nur Marketing: Meta lädt, Clarity bleibt vollständig blockiert.
5. Widerruf: Consent-Update auf `denied`, bekannte Anbieter-Cookies gelöscht.
6. Reload: Auswahl wird vor dem GTM-Aufruf wiederhergestellt.
7. Datenschutz-Einstellungen bleiben über das Schild-Symbol erreichbar.
8. `/admin-termine/` und die 404-Seite laden kein Tracking.
9. Die ausgelieferte CSP blockiert keine vorgesehenen Anbieter und erlaubt keine
   zusätzlichen, nicht benötigten Anbieter.
10. GA4 DebugView, Tag Assistant, Clarity und Meta Events Manager zeigen
    ausschließlich Testereignisse ohne unmaskierte personenbezogene Parameter.

Die Datenschutzerklärung und die endgültige Consent-Konfiguration
sollten vor dem Livegang juristisch geprüft werden.
