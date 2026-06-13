import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover the PURE, React-free, native-free modules only (feature
// access, cleanup-report selectors, perceptual-hash utils). Modules that import
// `@/i18n` or native/expo modules are intentionally out of scope here.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      // `.href` keeps the arg a string — avoids the DOM-vs-Node URL type clash
      // when this config is included in the app's `tsc --noEmit` typecheck.
      "@": fileURLToPath(new URL("./src", import.meta.url).href)
    }
  }
});
