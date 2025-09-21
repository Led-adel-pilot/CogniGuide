import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PdfPayload {
  markup: string;
  styles?: string;
  width: number;
  height: number;
  background?: string;
  title?: string;
  htmlAttributes?: Record<string, string | null | undefined>;
  bodyAttributes?: Record<string, string | null | undefined>;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  };
  baseUrl?: string;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildAttributeString(attrs?: Record<string, string | null | undefined>): string {
  if (!attrs) return '';
  const segments: string[] = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === '') continue;
    segments.push(`${key}="${escapeAttribute(String(val))}"`);
  }
  return segments.join(' ');
}

function resolveBaseUrl(req: NextRequest, override?: string): string {
  if (override && /^https?:\/\//i.test(override)) {
    return override.endsWith('/') ? override : `${override}/`;
  }
  const origin = req.nextUrl?.origin ?? '';
  return origin.endsWith('/') ? origin : `${origin}/`;
}

function sanitizeFilename(name?: string): string {
  const fallback = 'mindmap';
  if (!name) return fallback;
  const cleaned = name
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim();
  return cleaned || fallback;
}

function buildDocumentHtml(payload: PdfPayload, req: NextRequest): { html: string; width: number; height: number } {
  const width = Math.max(1, Math.ceil(payload.width));
  const height = Math.max(1, Math.ceil(payload.height));
  const htmlAttrs = buildAttributeString(payload.htmlAttributes);
  const bodyAttrs = buildAttributeString(payload.bodyAttributes);
  const background = payload.background ?? '#ffffff';
  const baseUrl = resolveBaseUrl(req, payload.baseUrl);
  const docTitle = payload.metadata?.title ?? payload.title ?? 'mindmap';
  const baseTag = baseUrl ? `<base href="${escapeAttribute(baseUrl)}" />` : '';
  const htmlOpen = htmlAttrs ? `<html ${htmlAttrs}>` : '<html>';
  const bodyOpen = bodyAttrs ? `<body ${bodyAttrs}>` : '<body>';

  const html = `<!DOCTYPE html>
${htmlOpen}
<head>
<meta charset="utf-8" />
<title>${escapeText(docTitle)}</title>
${baseTag}
${payload.styles ?? ''}
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: ${width}px;
    height: ${height}px;
    background: ${background};
  }
  #mindmap-export-wrapper {
    width: ${width}px;
    height: ${height}px;
    background: ${background};
    overflow: hidden;
  }
  @page {
    size: ${width}px ${height}px;
    margin: 0;
  }
</style>
</head>
${bodyOpen}
${payload.markup}
</body>
</html>`;

  return { html, width, height };
}

async function resolveExecutablePath(): Promise<string> {
  const isWindows = process.platform === 'win32';
  const candidates: Array<string | null | undefined> = [];

  if (!isWindows) {
    try {
      candidates.push(await chromium.executablePath());
    } catch (error) {
      console.warn('Failed to resolve bundled Chromium path:', error);
    }
  }

  candidates.push(
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH
  );

  if (isWindows) {
    candidates.push(
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
      'C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    candidates.push('/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (existsSync(candidate)) return candidate;
  }

  throw new Error('Unable to resolve a Chromium executable path.');
}

async function launchBrowser(viewportWidth: number, viewportHeight: number): Promise<Browser> {
  const executablePath = await resolveExecutablePath();
  const normalizedPath = executablePath.replace(/\\/g, '/').toLowerCase();
  const usingBundledChromium = normalizedPath.includes('/tmp/chromium') || normalizedPath.includes('/appdata/local/temp/chromium');
  const isBrave = normalizedPath.includes('brave-browser');

  const headlessForBundled = (chromium as unknown as { headless?: boolean | 'shell' }).headless ?? 'shell';
  const headlessMode: boolean | 'shell' = usingBundledChromium ? headlessForBundled : true;

  const baseArgs = usingBundledChromium
    ? [...chromium.args]
    : isBrave
      ? [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]
      : [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ];

  const launchArgs = [...baseArgs, '--font-render-hinting=none', '--enable-font-antialiasing'];

  return puppeteer.launch({
    args: launchArgs,
    defaultViewport: {
      width: Math.max(1, Math.ceil(viewportWidth)),
      height: Math.max(1, Math.ceil(viewportHeight)),
      deviceScaleFactor: 1,
    },
    executablePath,
    headless: headlessMode,
  });
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;

  try {

    const payload = (await req.json()) as PdfPayload;
    if (!payload || typeof payload.markup !== 'string' || !payload.markup.trim()) {
      return NextResponse.json({ error: 'Invalid payload: markup is required.' }, { status: 400 });
    }
    if (!Number.isFinite(payload.width) || !Number.isFinite(payload.height)) {
      return NextResponse.json({ error: 'Invalid payload: width and height are required.' }, { status: 400 });
    }

    const { html, width, height } = buildDocumentHtml(payload, req);

    browser = await launchBrowser(width, height);
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: `${width}px`,
      height: `${height}px`,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer;
    const fileName = sanitizeFilename(payload.title ?? payload.metadata?.title);

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Mind map PDF export failed:', error);
    return NextResponse.json({ error: 'Failed to render mind map PDF.' }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Failed to close Chromium browser instance:', closeError);
      }
    }
  }
}

