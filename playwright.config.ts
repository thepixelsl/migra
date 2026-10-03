import { defineConfig } from "@playwright/test";
import { productionTrackingDefaults } from "./src/config/trackingDefaults.mjs";

const consentCookieValue = encodeURIComponent(
  JSON.stringify({
    version: process.env.PUBLIC_CONSENT_VERSION ?? productionTrackingDefaults.consentVersion,
    necessary: true,
    analytics: false,
    clarity: false,
    marketing: false,
    services: {
      googleTagManager: false,
      googleAnalytics: false,
      googleAds: false,
      microsoftClarity: false,
      metaPixel: false,
      openaiAds: false,
    },
    updatedAt: new Date().toISOString(),
  }),
);

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["privacy-acceptance.spec.ts", "privacy-release.spec.ts"],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    browserName: "chromium",
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    storageState: {
      cookies: [
        {
          name: "artbild_consent",
          value: consentCookieValue,
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
        {
          name: "artbild_consent",
          value: consentCookieValue,
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
});
