import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const expectedParagraphs = [
  "Von einem Fotografen, der wie ein fremder Dienstleister wirkt, lässt man sich bestimmt nicht so gerne fotografieren, als von einem anderen Gast.",
  "Trotz allem bin ich natürlich Dienstleister und mache die Bilder, die Ihr Euch wünscht. Selbstverständlich hat jeder Hochzeitsfotograf seinen Stil und in diesem Stil kann er auch am besten seine Hochzeitsfotografie machen.",
  "Am besten funktioniert die Hochzeitsfotografie aus meiner Sicht, wenn Ihr mich zu einfach fotografieren lasst und auf meine Erfahrung vertraut. Damit Ihr trotzdem die Bilder bekommt, die Ihr Euch vorstellt, machen wir natürlich ein Vorgespräch und ein Kennenlernshooting.",
  "Das Kennenlernshooting ist nicht nur für Euch wichtig, sondern auch für mich. Nicht nur Ihr lernt mich kennen sondern auch ich Euch. Ich erfahre, wie ich Euch am besten fotografieren kann, welchen Stil Ihr mögt und wir bauen eine Verbindung auf.",
  "Bei der Hochzeit ist der Fotograf mehr als nur ein Bildermacher. Weißes Seidenpflaster und Nähzeug, wie man Manschettenknöpfe richtig trägt und ob Krawatte, Haarschmuck und Ring richtig sitzen machen mich zum Lotsen und zum Freund, der für Euch da ist.",
  "Ich begleite Eure Hochzeit gerne – bis zu 10 Stunden. Natürlich kann ich Euch auch länger begleiten. Manchmal lohnt es sich auch eine Reportage zu splitten, gerade wenn die Hochzeit in Italien oder Spanien stattfinden soll.",
  "Bei mir bekommt Ihr alles an guten Bildern, die am Tag der Hochzeit entstehen. Nirgends steht eine feste Zahl.",
  "Natürlich werden alle Bilder bearbeitet und ich erstelle eine Auswahl aus farbigen und schwarzweiß Bildern. Aus den schönsten Bildern erstelle ich eine Diashow, eine Online-Galerie und auch ein Fotobuch. (Diashow und Fotobuch, sowie eine individuelle, von einer Manufaktur handgefertigte Holzschatulle, mit USB-Stick sind für Gasnztagesbuchungen verfügbar).",
  "York Augustin ist eingetragener Fotograf in der Handwerksrolle der Hansestadt Hamburg.",
  "Es kommen keine weiteren Kosten auf Euch zu. Möchtet Ihr eine Fotobox dazu buchen? Kein Problem, ich empfehle Euch einen guten und sehr günstigen Anbieter hier aus Norddeutschland.",
  "Bearbeitung der Bilder bedeutet, dass sie einen farbigen Look oder auch Schwarzweiß-Look meiner Wahl erhalten. Das bedeutet nicht, dass ich Bilder retuschiere. Eine Retusche ist jedoch für wenige, ausgewählte Bilder ohne Aufpreis möglich.",
  "Pickel oder ähnliches die Dir an Deinem Hochzeitstag Ärger machen, werde ich natürlich entfernen, das ist selbstverständlich.",
];

const suppliedCopySelector = [
  ".about-wedding-guide__lead > p",
  ".about-approach__step > p:not(.about-approach__number)",
  ".about-credential > p:last-child",
  ".about-faq__item > p:not(.about-faq__number)",
].join(", ");

const faqQuestions = [
  "Wie viele Bilder bekommen wir?",
  "Was gehört zur Bildübergabe?",
  "Entstehen weitere Kosten?",
  "Was bedeutet Bildbearbeitung und Retusche?",
];

test("about content has a clear editorial hierarchy on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/about/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  const section = page.locator(".about-wedding-guide");
  const approach = section.locator(".about-approach");
  const steps = approach.locator(".about-approach__step");
  const faqItems = section.locator(".about-faq__item");
  const suppliedCopy = section.locator(suppliedCopySelector);

  await expect(section.getByRole("heading", { name: "Hochzeitsfotograf Hamburg" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Vertrauen beginnt vor dem Hochzeitstag" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Mehr als nur ein Bildermacher" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Antworten vor Eurer Buchung" })).toBeVisible();
  await expect(steps).toHaveCount(2);
  await expect(faqItems).toHaveCount(4);
  await expect(faqItems.locator("h4")).toHaveText(faqQuestions);
  await expect(suppliedCopy).toHaveCount(12);
  await expect(suppliedCopy).toHaveText(expectedParagraphs);

  const layout = await section.evaluate((element) => {
    const header = element.querySelector(".about-wedding-guide__header")!;
    const approach = element.querySelector(".about-approach")!;
    const faqList = element.querySelector(".about-faq__list")!;
    const steps = [...element.querySelectorAll(".about-approach__step")];
    return {
      headerColumns: getComputedStyle(header).gridTemplateColumns,
      approachColumns: getComputedStyle(approach).gridTemplateColumns,
      faqColumns: getComputedStyle(faqList).gridTemplateColumns,
      stepWidths: steps.map((step) => step.getBoundingClientRect().width),
      secondStepBorder: getComputedStyle(steps[1]).borderLeftWidth,
      faqBackgrounds: [...element.querySelectorAll(".about-faq__item")].map(
        (item) => getComputedStyle(item).backgroundColor,
      ),
    };
  });

  expect(layout.headerColumns.split(" ")).toHaveLength(2);
  expect(layout.approachColumns.split(" ")).toHaveLength(2);
  expect(layout.faqColumns.split(" ")).toHaveLength(2);
  expect(layout.stepWidths[0]).toBeCloseTo(layout.stepWidths[1], 0);
  expect(layout.secondStepBorder).toBe("1px");
  expect(layout.faqBackgrounds.every((background) => background === "rgba(0, 0, 0, 0)")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`about editorial modules stack cleanly on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/about/`, { waitUntil: "domcontentloaded" });

    const section = page.locator(".about-wedding-guide");
    const steps = section.locator(".about-approach__step");
    const faqItems = section.locator(".about-faq__item");
    await expect(steps).toHaveCount(2);
    await expect(faqItems).toHaveCount(4);
    await expect(steps.nth(1)).toHaveCSS("border-top-width", "1px");
    await expect(steps.nth(1)).toHaveCSS("border-left-width", "0px");
    await expect(section.locator(suppliedCopySelector)).toHaveText(expectedParagraphs);

    const stepBoxes = await steps.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }),
    );
    const faqBoxes = await faqItems.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }),
    );
    expect(stepBoxes[1].top).toBeGreaterThan(stepBoxes[0].bottom);
    expect(faqBoxes[1].top).toBeGreaterThan(faqBoxes[0].bottom);
    expect([...stepBoxes, ...faqBoxes].every((box) => box.left >= 0 && box.right <= viewport.width)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
