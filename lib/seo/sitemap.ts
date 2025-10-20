import { siteMetadata } from '@/lib/siteMetadata';

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

export type SitemapIndexEntry = SitemapEntry;

const baseUrl = (() => {
  const fallback = siteMetadata.url;
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? fallback;
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
})();

const buildTimestamp = (() => {
  const override = process.env.SITEMAP_DEFAULT_LASTMODIFIED ?? process.env.SITEMAP_BUILD_LASTMODIFIED;
  if (!override) {
    return new Date();
  }

  const parsed = new Date(override);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
})();

const defaultLastmod = () => buildTimestamp.toISOString();

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const ensureAbsoluteUrl = (pathOrUrl: string): string => {
  try {
    const url = new URL(pathOrUrl);
    return url.toString();
  } catch {
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return new URL(normalizedPath, `${baseUrl}/`).toString();
  }
};

export const formatLastmod = (value?: string | Date): string => {
  if (value) {
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return defaultLastmod();
};

export const latestLastmod = (entries: SitemapEntry[]): string => {
  if (entries.length === 0) {
    return defaultLastmod();
  }

  return entries
    .map((entry) => entry.lastmod ?? defaultLastmod())
    .reduce((latest, current) => (current > latest ? current : latest));
};

export const createUrlSetXml = (entries: SitemapEntry[]): string => {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ?? defaultLastmod();
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
};

export const createSitemapIndexXml = (entries: SitemapIndexEntry[]): string => {
  const sitemaps = entries
    .map((entry) => {
      const lastmod = entry.lastmod ?? defaultLastmod();
      return `  <sitemap>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>`;
};

export const xmlResponse = (xml: string): Response =>
  new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
