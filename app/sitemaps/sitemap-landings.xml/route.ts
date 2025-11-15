import { createUrlSetXml, xmlResponse } from '@/lib/seo/sitemap';
import { getProgrammaticLandingSitemapEntries } from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const entries = getProgrammaticLandingSitemapEntries();
  return xmlResponse(createUrlSetXml(entries));
}
