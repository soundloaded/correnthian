import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  base: "/",
  resolve: { tsconfigPaths: true },
  plugins: [
  // Devtools ship their own websocket client: development only, never the
  // production bundle an operator audits.
  ...(process.env.NODE_ENV !== "production" ? [devtools()] : []),
  tailwindcss(),
  tanstackStart({
    spa: {
      enabled: true,
    },
  }),
  viteReact(),
],
})

export default config