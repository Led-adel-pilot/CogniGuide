import { createUrlSetXml, xmlResponse } from '@/lib/seo/sitemap';
import { getFlashcardLandingSitemapEntries } from '@/lib/seo/sitemapSections';

export async function GET(): Promise<Response> {
  const entries = getFlashcardLandingSitemapEntries();
  return xmlResponse(createUrlSetXml(entries));
}
