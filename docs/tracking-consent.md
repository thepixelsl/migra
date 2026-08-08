# Consent, Google Tag Manager und Meta Pixel

## Architektur

Die Website trennt Einwilligung, Ereignisse und Anbieter:

1. `TrackingHead.astro` setzt vor dem Google Tag Manager den Advanced Consent
   Mode und liest eine bestehende Einwilligung.
2. `ConsentBanner.astro` verwaltet die Kategorien `necessary`, `analytics` und
   `marketing`.
3. `TrackingDataLayer.astro` erzeugt ausschließlich strukturierte Ereignisse
   ohne Formularinhalte oder angefragte Termine.
4. Google Analytics wird über den Google Tag Manager konfiguriert.
5. Das Meta Pixel wird direkt von der Website geladen, jedoch erst nach
   `marketing: true`. Es darf deshalb nicht zusätzlich im GTM angelegt werden.

Die Anbieterkennungen sind öffentliche Build-Konfiguration. Sie sind keine
Geheimnisse, sollen aber nicht im Quellcode verteilt werden.

## Umgebungen

Die Vorlage steht in `.env.example`.

| Wert | Verhalten |
| --- | --- |
| `disabled` | Kein Banner und keine Drittanbieter |
| `staging` | Banner aktiv; Anbieter nur bei vollständigen IDs und erlaubtem Host |
| `test` | Ausschließlich für künstliche Test-IDs |
| `production` | Alle echten IDs sind verpflichtend; Platzhalter brechen den Build ab |

Der Standard ist `staging` ohne Anbieterkennungen. Damit kann der Banner
gestaltet und getestet werden, ohne Daten an Google oder Meta zu senden.

`PUBLIC_TRACKING_ALLOWED_HOSTS` ist eine zweite Sicherung im Browser. Ein
Production-Build lädt seine Anbieter nur auf einem explizit freigegebenen
Host. Die in `astro.config.mjs` konfigurierte kanonische URL ist ausdrücklich
kein Tracking-Schalter.

## Umschaltung auf die .de-Domain

Vor dem Livegang werden in der Cloudflare-Buildumgebung gesetzt:

```text
PUBLIC_TRACKING_ENV=production
PUBLIC_TRACKING_ALLOWED_HOSTS=artbild-fotografie.de,www.artbild-fotografie.de
PUBLIC_GTM_CONTAINER_ID=GTM-…
PUBLIC_GA4_MEASUREMENT_ID=G-…
PUBLIC_META_PIXEL_ID=…
PUBLIC_CONSENT_VERSION=2026-07-29.1
```

Diese Werte müssen dem Astro-Build zur Verfügung stehen. Ein Eintrag unter
Wrangler `[vars]` oder in `.dev.vars` reicht nicht aus, weil die Website
statisch gebaut wird.

Der Production-Build schlägt fehl, wenn eine Kennung fehlt, ein Format nicht
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
4. GA4-Ereignistags für die freigegebenen Ereignisse aus der folgenden Tabelle.
5. Kein Meta-Basistag und kein zweites Meta Pixel im GTM.

Vor Veröffentlichung muss der Container im Preview-Modus und anschließend mit
Tag Assistant geprüft werden.

## Ereignisvertrag

| Data-Layer-Ereignis | Bedeutung | Empfohlene GA4-Zuordnung |
| --- | --- | --- |
| `section_view` | Inhaltsbereich wurde tatsächlich sichtbar | benutzerdefiniert |
| `cta_click` | Interner CTA oder Navigationsaktion | benutzerdefiniert |
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

## Consent-Verhalten

Standardwerte vor GTM:

```text
analytics_storage=denied
ad_storage=denied
ad_user_data=denied
ad_personalization=denied
security_storage=granted
```

Zusätzlich sind `ads_data_redaction=true` und `url_passthrough=false` gesetzt.
Im Advanced Mode kann Google cookielose Signale erhalten. Meta wird vor einer
Marketing-Einwilligung technisch nicht geladen.

Der First-Party-Cookie `artbild_consent` speichert Auswahl, Version und
Zeitpunkt für sechs Monate. Eine Änderung von `PUBLIC_CONSENT_VERSION`
invalidiert alte Entscheidungen und zeigt den Banner erneut.

Jeder interne Query-Parameter `termin` wird vor dem Start der Anbieter aus der
URL entfernt. Nur ein gültiger Wert im Format `YYYY-MM-DD` wird kurzzeitig in
`sessionStorage` gehalten und danach in das Kontaktformular übernommen. Kann
die URL nicht sicher bereinigt werden, bleiben die Anbieter für diesen Aufruf
deaktiviert. Der Termin erscheint weder im Data Layer noch in einer
Pageview-URL.

## Abnahme vor Production

1. Frisches Browserprofil: Standardwerte sind vor GTM auf `denied`.
2. „Nur notwendige“: keine GA-, GCL-, FBP- oder FBC-Cookies.
3. Nur Statistik: Analytics erlaubt, Meta weiterhin vollständig blockiert.
4. Marketing: Meta lädt genau einmal mit der vorgesehenen Pixel-ID.
5. Widerruf: Consent-Update auf `denied`, bekannte Anbieter-Cookies gelöscht.
6. Reload: Auswahl wird vor dem GTM-Aufruf wiederhergestellt.
7. Datenschutz-Einstellungen bleiben über das Schild-Symbol erreichbar.
8. `/admin-termine/` und die 404-Seite laden kein Tracking.
9. Cloudflare-CSP blockiert keine vorgesehenen Anbieter und erlaubt keine
   zusätzlichen, nicht benötigten Anbieter.
10. GA4 DebugView, Tag Assistant und Meta Events Manager zeigen ausschließlich
    Testereignisse ohne personenbezogene Parameter.

Die Datenschutzerklärung und die endgültige Advanced-Mode-Konfiguration
sollten vor dem Livegang juristisch geprüft werden.
