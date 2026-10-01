import { defineConfig } from '@playwright/test';
const reportDir = process.env.PRIVACY_REPORT_DIR || 'reports/tracking-activation-2026-10-01';
export default defineConfig({
 outputDir: `${reportDir}/release-artifacts`, testDir: './tests', testMatch: 'privacy-release.spec.ts', timeout: 45000, workers: 3,
 reporter: [['list'], ['json',{outputFile:`${reportDir}/release-results.json`}]],
 use: {baseURL:process.env.ASTRO_URL || 'http://127.0.0.1:4329',storageState:{cookies:[],origins:[]},serviceWorkers:'block',trace:'retain-on-failure'},
 projects:['chromium','firefox','webkit'].map(browserName=>({name:browserName,use:{browserName:browserName as 'chromium'|'firefox'|'webkit'}}))
});
