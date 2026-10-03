import { defineConfig, devices } from "@playwright/test";
const reportDir = process.env.PRIVACY_REPORT_DIR || "reports/tracking-activation-2026-10-01";
export default defineConfig({
  outputDir: `${reportDir}/acceptance-artifacts`, testDir: "./tests", testMatch: "privacy-acceptance.spec.ts", timeout: 45000,
  fullyParallel: true, workers: 4,
  reporter: [["list"], ["json", { outputFile: `${reportDir}/test-results.json` }],
    ["html", { outputFolder: `${reportDir}/html`, open: "never" }]],
  use: { baseURL: process.env.ASTRO_URL || (process.env.PRIVACY_PRODUCTION_ORIGIN ? "https://artbild-fotografie.de" : "http://127.0.0.1:4341"), storageState: { cookies: [], origins: [] },
    trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" }, grepInvert: /matrix|real transport/ },
    { name: "webkit", use: { browserName: "webkit" }, grepInvert: /matrix|real transport/ }],
});
