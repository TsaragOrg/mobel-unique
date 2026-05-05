import { defineConfig } from "vitest/config";

// The in-home simulation worker is a Deno module that imports
// imagescript via a Deno-only URL. Vitest runs in Node and cannot
// follow `https://deno.land/...` URLs. Aliasing the Deno URL to the
// npm `imagescript` package (already a dev dependency) lets the same
// .ts files be exercised from vitest in Node without changing the
// production import.
export default defineConfig({
  resolve: {
    alias: {
      "https://deno.land/x/imagescript@1.2.17/mod.ts": "imagescript"
    }
  }
});
