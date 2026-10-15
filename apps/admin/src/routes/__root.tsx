import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import appCss from "@correnthian/ui/globals.css?url"

import { ThemeProvider } from "@correnthian/ui/components/theme-provider"

const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem("theme") || "system";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        // Interim posture, stated honestly: script/style need
        // 'unsafe-inline' (theme init script, Tailwind runtime), and images
        // stay open until the mock-data pages are rewired to the API — at
        // which point img-src tightens to 'self' data:. Deployment headers
        // with a nonce replace this meta tag when a host exists.
        httpEquiv: "Content-Security-Policy",
        content:
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https:; object-src 'none'; base-uri 'self'; form-action 'self'",
      },
      {
        title: "Correnthian Admin",
      },
      {
        name: "description",
        content:
          "Correnthian Admin — internal operations console.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: `${import.meta.env.BASE_URL}favicon-32x32.png`,
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: `${import.meta.env.BASE_URL}favicon-16x16.png`,
      },
      {
        rel: "icon",
        type: "image/x-icon",
        href: `${import.meta.env.BASE_URL}favicon.ico`,
      },
    ],
  }),

  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>

      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}