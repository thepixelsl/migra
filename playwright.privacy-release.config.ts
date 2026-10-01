import { defineConfig } from '@playwright/test';
export default defineConfig({
 outputDir: "reports/tracking-activation-2026-10-01/release-artifacts", testDir: './tests', testMatch: 'privacy-release.spec.ts', timeout: 45000, workers: 3,
 reporter: [['list'], ['json',{outputFile:'reports/tracking-activation-2026-10-01/release-results.json'}]],
 use: {baseURL:process.env.ASTRO_URL || 'http://127.0.0.1:4329',storageState:{cookies:[],origins:[]},serviceWorkers:'block',trace:'retain-on-failure'},
 projects:['chromium','firefox','webkit'].map(browserName=>({name:browserName,use:{browserName:browserName as 'chromium'|'firefox'|'webkit'}}))
});
