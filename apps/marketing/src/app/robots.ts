import type { MetadataRoute } from 'next'

function siteOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return undefined
  return raw.replace(/\/+$/, '')
}

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  }
}
