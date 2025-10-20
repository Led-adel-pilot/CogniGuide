import { createUrlSetXml, xmlResponse } from '@/lib/seo/sitemap';
import { getHubSitemapEntries } from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const entries = getHubSitemapEntries();
  return xmlResponse(createUrlSetXml(entries));
}
