import path from "node:path"
import { defineConfig } from "vitest/config"

const root = import.meta.dirname;

/**
 * Standalone test config, deliberately separate from vite.config.ts.
 *
 * Vitest auto-loads vite.config.ts when no vitest config exists, and the
 * TanStack Start plugin crashes under vitest's bundled Vite. Unit tests here
 * need aliases only — never the app plugin chain.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@correnthian/ui": path.resolve(root, "../../packages/ui/src"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    environment: "node",
  },
})
