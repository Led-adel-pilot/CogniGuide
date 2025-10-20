import { createUrlSetXml, xmlResponse } from '@/lib/seo/sitemap';
import { getCoreSitemapEntries } from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const entries = getCoreSitemapEntries();
  return xmlResponse(createUrlSetXml(entries));
}
