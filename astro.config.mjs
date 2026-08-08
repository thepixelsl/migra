import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://artbild-fotografie.de",
  output: "static",
  server: {
    host: "127.0.0.1",
    port: 4321
  }
});
