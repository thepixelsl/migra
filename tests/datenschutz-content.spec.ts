import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const removedLegacyTerms = [
  "WordPress",
  "Borlabs",
  "Google Site Kit",
  "Cloudflare",
  "Cloudflare Germany GmbH",
  "Bereitstellung über Cloudflare",
  "Cloudflare Worker konfiguriert",
  "Pinterest-Plugin",
  "Browser-Plugin",
  "Facebook-Plugins",
  "MailChimp",
  "Privacy Shield Framework",
];

const removedInfrastructureTerms = [
  "Astro-Website",
  "Node.js-Container",
  "Magic Containers",
  "Bunny-CDN-Endpunkt",
  "Bunny Database",
  "globales CDN",
  "HTTPS-Relay",
  "SHA-256-Hash",
  "geheimen Salt",
  "sessionStorage",
  "URL-Parameter",
  "öffentlich erreichbaren Endpunkt",
  "Data Layer",
  "Containerkonfiguration",
  "Pixel-ID",
  "lokale Ereigniscode",
  "Dienstkennung",
  "produktiv hinterlegt",
  "muss vor der produktiven Aktivierung",
  "über den Tag Manager verwalteter Marketingdienst",
];

const requiredOptionalServiceTerms = [
  "Cookies und Einwilligungen",
  "artbild_consent",
  "Google Tag Manager",
  "Google Analytics 4",
  "Meta Pixel",
  "Microsoft Clarity",
  "Drittlandübermittlungen bei Statistik- und Marketingdiensten",
];

test("privacy page names providers, locations and processed data without infrastructure details", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/datenschutz/`, { waitUntil: "domcontentloaded" });

  const main = page.locator("main");
  const mainText = await main.innerText();

  expect(mainText).toContain("Stand: 27. August 2026");
  expect(mainText).toContain("Webhosting bei bunny.net");
  expect(mainText).toContain("BunnyWay d.o.o.");
  expect(mainText).toContain("Dunajska cesta 165");
  expect(mainText).toContain("Standort des Webservers ist Frankfurt am Main");
  expect(mainText).toContain("Website-Datenbank");
  expect(mainText).toContain("ausschließlich in Frankfurt am Main gespeichert");
  expect(mainText).toContain("IP-Adresse");
  expect(mainText).toContain("Datum und Uhrzeit des Aufrufs");
  expect(mainText).toContain("Angaben zu Browser, Betriebssystem und verwendetem Gerät");

  expect(mainText).toContain("aus der IP-Adresse gebildete pseudonymisierte Kennung");
  expect(mainText).toContain("nicht zusammen mit dem Formulardatensatz gespeichert");
  expect(mainText).toContain("Das Wunschdatum ist außer bei TFP-Anfragen ebenfalls erforderlich");
  expect(mainText).toContain("Es besteht keine gesetzliche Pflicht, diese Daten bereitzustellen");
  expect(mainText).toContain("pseudonymisierte IP-Kennung");
  expect(mainText).toContain("spätestens nach 30 Minuten entfernt");
  expect(mainText).toContain("Speicherdauer von 30 Tagen überschritten");
  expect(mainText).toContain("an unser E-Mail-Postfach bei STRATO übermittelt");
  expect(mainText).toContain("STRATO GmbH");
  expect(mainText).toContain("Für die Verarbeitung und Speicherung von E-Mails nutzen wir STRATO");
  expect(mainText).toContain("Kontakt über WhatsApp");
  expect(mainText).toContain("WhatsApp Ireland Limited");
  expect(mainText).toContain("vorgegebene Nachrichtentext an WhatsApp übermittelt");
  expect(mainText).toContain("Begrenzte Terminabfrage für Buchungsagenten");
  expect(mainText).toContain("ein bis drei konkrete Wunschdaten");
  expect(mainText).toContain("höchstens zwei erfolgreiche Abfragen innerhalb von 24 Stunden");
  expect(mainText).toContain("pseudonyme Kurzzeitkennung");
  expect(mainText).toContain("weder die vollständige IP-Adresse noch den User-Agent");
  expect(mainText).toContain("Art. 6 Abs. 1 lit. f DSGVO");
  expect(mainText).toContain("im nächsten regelmäßigen Bereinigungslauf gelöscht");

  expect(mainText).toContain("Google Tag Manager, Google Analytics 4, Microsoft Clarity und Meta Pixel werden erst nach Ihrer Einwilligung");
  expect(mainText).toContain("Google Tag Manager, Google Analytics 4, Microsoft Clarity und Meta Pixel im Banner einzeln auswählen");
  expect(mainText).toContain("Wenn Sie ihn deaktivieren, werden Google Analytics 4, Microsoft Clarity und Meta Pixel ebenfalls deaktiviert");
  expect(mainText).toContain("Vor Ihrer Einwilligung wird der Tag Manager vollständig blockiert");
  expect(mainText).not.toContain("erweiterten Einwilligungsmodus");
  expect(mainText).toContain("Cookie enthält die gewählten Services");
  expect(mainText).toContain("Einwilligung in den Service „Google Analytics 4“");
  expect(mainText).toContain("Einwilligung in den Service „Microsoft Clarity“");
  expect(mainText).toContain("Einwilligung in den Service „Meta Pixel“");
  expect(mainText).toContain("Service-Gruppen, Services und Provider");
  expect(mainText).toContain("Google Ireland Limited");
  expect(mainText).toContain("HTTP-Protokolldaten innerhalb von 14 Tagen");
  expect(mainText).toMatch(
    /Aufbewahrungsfrist für Nutzer- und Ereignisdaten beträgt (2|14) Monate/,
  );
  expect(mainText).toContain("Meta Platforms Ireland Limited");
  expect(mainText).toContain("Laufzeit von bis zu 90 Tagen");
  expect(mainText).toContain("Zielgruppen bleiben bestehen, bis sie im Meta-Konto gelöscht werden");
  expect(mainText).toContain("gemeinsam verantwortlich");
  expect(mainText).toContain("Betroffenenrechte können sowohl bei uns als auch bei Meta");
  expect(mainText).toContain("Informations- und Betroffenenrechte ist Meta verantwortlich");
  expect(mainText).toContain("höchstens zwei Jahren");
  expect(mainText).toContain("Microsoft Ireland Operations Limited");
  expect(mainText).toContain("Wiedergabedaten werden 30 Tage gespeichert");
  expect(mainText).toContain("Kontakt-, Anfrage- und Terminformulare");
  expect(mainText).toContain("Microsoft Advertising (ehemals Bing Ads)");
  expect(mainText).toContain("nicht Bestandteil der hier beschriebenen Clarity-Nutzung");
  expect(mainText).toContain("EU-Standardvertragsklauseln");
  expect(mainText).toContain("Google LLC, Meta Platforms, Inc. und Microsoft Corporation");
  expect(mainText).toContain("für das EU-US Data Privacy Framework zertifiziert");
  expect(mainText).toContain("WhatsApp LLC und Meta Platforms, Inc.");
  expect(mainText).toContain("Standardvertragsklauseln an");

  expect(mainText).toContain("PicDrop GmbH");
  expect(mainText).toContain("Am Kupfergraben 4/4a");
  expect(mainText).toContain("technische Protokolldaten eine Löschung nach 90 Tagen");

  for (const term of removedInfrastructureTerms) {
    expect(mainText).not.toContain(term);
  }
  for (const term of requiredOptionalServiceTerms) {
    expect(mainText).toContain(term);
  }

  await expect(main.locator('a[href="https://bunny.net/privacy/"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://bunny.net/gdpr/sub-processors/"]')).toHaveCount(0);
  await expect(main.locator('a[href="https://www.strato.de/datenschutz/"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://support.google.com/tagmanager/answer/9323295?hl=de"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://support.google.com/analytics/answer/7667196?hl=de"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://www.facebook.com/legal/controller_addendum"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://policies.google.com/privacy/frameworks?hl=de"]')).toHaveCount(2);
  await expect(main.locator('a[href="https://www.facebook.com/privacy/policies/data_privacy_framework/"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://www.facebook.com/legal/terms/Privacy/GDTA"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://learn.microsoft.com/en-us/clarity/faq"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention"]')).toHaveCount(1);
  await expect(main.locator('a[href="https://www.dataprivacyframework.gov/list"]')).toHaveCount(1);
  await expect(main.locator('a[href^="https://www.e-recht24.de/"]')).toHaveCount(0);
  await expect(main.locator('a[href="https://www.e-recht24.de/dsg/13252-bunny-net-cdn.html"]')).toHaveCount(0);
  await expect(main.locator('a[href*="/wp-content/"]')).toHaveCount(0);
});

test("both privacy URLs render no obsolete CMS or plugin declaration", async ({
  page,
}) => {
  for (const pathname of ["/datenschutz/", "/datenschutzerklaerung/"]) {
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
    const mainText = await page.locator("main").innerText();

    expect(mainText).toContain("Webhosting bei bunny.net");
    for (const term of removedLegacyTerms) {
      expect(mainText).not.toContain(term);
    }
    for (const term of removedInfrastructureTerms) {
      expect(mainText).not.toContain(term);
    }
    for (const term of requiredOptionalServiceTerms) {
      expect(mainText).toContain(term);
    }
    await expect(page.locator('main a[href*="/wp-content/"]')).toHaveCount(0);
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/datenschutz/",
  );
});

test("provides consent settings for the configured production providers", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/datenschutz/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-consent-dialog]")).toHaveCount(1);
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  await expect(page.locator("[data-consent-settings]")).toBeVisible();

  const trackingConfig = await page.locator("#artbild-tracking-config").textContent();
  expect(JSON.parse(trackingConfig ?? "{}")).toMatchObject({
    consentEnabled: true,
    gtmContainerId: "GTM-5TM37JC",
    googleAnalyticsId: "G-TSWGFD1YKF",
  });
});

test("contact form confirms notice instead of requesting unnecessary consent", async ({
  page,
}) => {
  await page.goto(`${baseUrl}/kontakt/?termin=2030-08-22`, { waitUntil: "domcontentloaded" });

  const privacyLabel = page.locator('label:has(input[name="privacy"])');
  await expect(privacyLabel).toContainText("Datenschutzerklärung zur Kenntnis genommen");
  await expect(privacyLabel).not.toContainText("Ich bin damit einverstanden");
  await expect(privacyLabel.locator("input")).toHaveAttribute("required", "");
  await expect(page.locator("[data-contact-date]")).toHaveValue("");
});
