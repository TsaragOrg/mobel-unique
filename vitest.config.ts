import { defineConfig } from "vitest/config";

// Some Supabase Edge Function modules import imagescript through a Deno-only
// URL. Vitest runs in Node and cannot follow `https://deno.land/...` URLs.
// Aliasing the Deno URL to the npm `imagescript` package lets those .ts files
// be exercised from vitest in Node without changing the production import.
export default defineConfig({
  resolve: {
    alias: {
      "https://deno.land/x/imagescript@1.2.17/mod.ts": "imagescript"
    }
  }
});
