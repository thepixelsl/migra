import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "static",

  server: {
    host: "127.0.0.1",
    port: 4321
  },

  adapter: cloudflare()
});