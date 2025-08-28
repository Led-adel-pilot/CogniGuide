// app/sitemap.ts
import { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.cogniguide.app'

const staticRoutes = [
  '/',
  '/pricing',
  '/contact',
  '/legal/terms',
  '/legal/privacy-policy',
  '/legal/refund-policy',
  '/legal/cancellation-policy',
  '/blog/how-to-study-for-exams',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map((path) => ({
    url: `${SITE}${path === '/' ? '' : path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority:
      path === '/' ? 1 : path.startsWith('/pricing') ? 0.9 : 0.6,
  }))
}
