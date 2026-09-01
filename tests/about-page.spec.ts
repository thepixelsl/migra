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

test("about longform keeps the supplied copy in a calm desktop spread", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/about/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  const section = page.locator(".about-longform");
  const columns = section.locator(".about-column");

  await expect(section.getByRole("heading", { name: "Hochzeitsfotograf Hamburg" })).toBeVisible();
  await expect(columns).toHaveCount(2);
  await expect(columns.nth(0).locator("p")).toHaveCount(6);
  await expect(columns.nth(1).locator("p")).toHaveCount(6);
  await expect(section.locator("p")).toHaveText(expectedParagraphs);

  const layout = await section.evaluate((element) => {
    const heading = element.querySelector("h2");
    const columnElements = [...element.querySelectorAll(".about-column")];
    return {
      headingSize: Number.parseFloat(getComputedStyle(heading!).fontSize),
      gridColumns: getComputedStyle(element.querySelector(".about-columns")!).gridTemplateColumns,
      columnWidths: columnElements.map((column) => column.getBoundingClientRect().width),
      secondColumnBorder: getComputedStyle(columnElements[1]).borderLeftWidth,
    };
  });

  expect(layout.headingSize).toBeLessThanOrEqual(30);
  expect(layout.gridColumns.split(" ")).toHaveLength(2);
  expect(layout.columnWidths[0]).toBeCloseTo(layout.columnWidths[1], 0);
  expect(layout.secondColumnBorder).toBe("1px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`about longform stacks cleanly on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/about/`, { waitUntil: "domcontentloaded" });

    const section = page.locator(".about-longform");
    const columns = section.locator(".about-column");
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(1)).toHaveCSS("border-top-width", "1px");
    await expect(columns.nth(1)).toHaveCSS("border-left-width", "0px");

    const boxes = await columns.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }),
    );
    expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
    expect(boxes.every((box) => box.left >= 0 && box.right <= viewport.width)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
