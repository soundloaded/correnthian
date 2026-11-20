import type { MetadataRoute } from 'next'

// Set NEXT_PUBLIC_SITE_URL later; sitemap URLs must be absolute, so omit entries until a real host exists.
const PATHS = ['/home', '/products/buy', '/products/buy-silver', '/products/swap', '/products/portfolio', '/products/activity', '/products/app', '/products/gold', '/products/silver', '/products/redemption', '/pricing', '/about', '/contact', '/waitlist', '/faqs', '/privacy-policy', '/terms', '/download'] as const

function siteOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return undefined
  return raw.replace(/\/+$/, '')
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin()
  if (!origin) return []

  return PATHS.map((path) => ({
    url: `${origin}${path}`,
  }))
}
