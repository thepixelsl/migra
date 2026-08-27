import { defineConfig } from "@playwright/test";

const consentCookieValue = encodeURIComponent(
  JSON.stringify({
    version: process.env.PUBLIC_CONSENT_VERSION ?? "2026-08-27.2",
    necessary: true,
    analytics: false,
    clarity: false,
    marketing: false,
    services: {
      googleTagManager: false,
      googleAnalytics: false,
      microsoftClarity: false,
      metaPixel: false,
    },
    updatedAt: "2026-07-29T00:00:00.000Z",
  }),
);

export default defineConfig({
  testDir: "./tests",
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
