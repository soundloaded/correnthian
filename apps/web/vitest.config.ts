import path from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Standalone test config with the `@` alias only — mirrors the admin's
 * split for the same reason: unit tests need path aliases, never the
 * Next plugin chain.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
})
