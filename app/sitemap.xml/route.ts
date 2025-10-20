import {
  createSitemapIndexXml,
  ensureAbsoluteUrl,
  latestLastmod,
  xmlResponse,
} from '@/lib/seo/sitemap';
import {
  getCoreSitemapEntries,
  getFlashcardLandingSitemapEntries,
  getHubSitemapEntries,
  getSubhubSitemapEntries,
} from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const coreEntries = getCoreSitemapEntries();
  const hubEntries = getHubSitemapEntries();
  const subhubEntries = getSubhubSitemapEntries();
  const landingEntries = getFlashcardLandingSitemapEntries();

  const index = [
    {
      loc: ensureAbsoluteUrl('/sitemaps/sitemap-core.xml'),
      lastmod: latestLastmod(coreEntries),
    },
    {
      loc: ensureAbsoluteUrl('/sitemaps/sitemap-hubs.xml'),
      lastmod: latestLastmod(hubEntries),
    },
    {
      loc: ensureAbsoluteUrl('/sitemaps/sitemap-subhubs.xml'),
      lastmod: latestLastmod(subhubEntries),
    },
    {
      loc: ensureAbsoluteUrl('/sitemaps/sitemap-landings.xml'),
      lastmod: latestLastmod(landingEntries),
    },
  ];

  return xmlResponse(createSitemapIndexXml(index));
}
