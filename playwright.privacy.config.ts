import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "reports/ads-datenschutz-2026-09-30/acceptance-artifacts", testDir: "./tests", testMatch: "privacy-acceptance.spec.ts", timeout: 45000,
  fullyParallel: true, workers: 4,
  reporter: [["list"], ["json", { outputFile: "reports/ads-datenschutz-2026-09-30/test-results.json" }],
    ["html", { outputFolder: "reports/ads-datenschutz-2026-09-30/html", open: "never" }]],
  use: { baseURL: process.env.ASTRO_URL || (process.env.PRIVACY_PRODUCTION_ORIGIN ? "https://artbild-fotografie.de" : "http://127.0.0.1:4341"), storageState: { cookies: [], origins: [] },
    trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" }, grepInvert: /matrix|real transport/ },
    { name: "webkit", use: { browserName: "webkit" }, grepInvert: /matrix|real transport/ }],
});
