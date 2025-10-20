import { createUrlSetXml, xmlResponse } from '@/lib/seo/sitemap';
import { getSubhubSitemapEntries } from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const entries = getSubhubSitemapEntries();
  return xmlResponse(createUrlSetXml(entries));
}
