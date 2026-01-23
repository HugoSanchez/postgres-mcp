import JSZip from 'jszip';
import type {
  EpubChapter,
  EpubImage,
  EpubMetadata,
  EpubOutlineItem,
  EpubTocItem,
  ParsedEpub,
} from './types';

/**
 * Parse an EPUB file and extract its structure
 */
export async function parseEpub(
  data: ArrayBuffer | Uint8Array
): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(data);

  // Step 1: Find the OPF file via container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const opfPath = extractOpfPath(containerXml);
  if (!opfPath) {
    throw new Error('Invalid EPUB: could not find OPF path in container.xml');
  }

  // Step 2: Parse the OPF file
  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) {
    throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
  }

  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
  const { metadata, manifest, spine, tocId } = parseOpf(opfContent);

  // Step 3: Extract chapters from spine
  const chapters: EpubChapter[] = [];
  for (let i = 0; i < spine.length; i++) {
    const itemId = spine[i];
    const manifestItem = manifest[itemId];
    if (!manifestItem) continue;

    const chapterPath = opfDir + manifestItem.href;
    const chapterContent = await zip.file(chapterPath)?.async('text');
    if (!chapterContent) continue;

    const text = extractTextFromHtml(chapterContent);
    const title = extractTitleFromHtml(chapterContent) || `Chapter ${i + 1}`;

    chapters.push({
      spineIndex: i,
      href: manifestItem.href,
      title,
      html: chapterContent,
      text,
    });
  }

  // Step 4: Parse TOC (try NCX first, then NAV)
  let toc: EpubTocItem[] = [];
  if (tocId && manifest[tocId]) {
    const tocPath = opfDir + manifest[tocId].href;
    const tocContent = await zip.file(tocPath)?.async('text');
    if (tocContent) {
      if (manifest[tocId].mediaType === 'application/x-dtbncx+xml') {
        toc = parseNcxToc(tocContent);
      } else {
        toc = parseNavToc(tocContent);
      }
    }
  }

  // Fallback: look for NCX file in manifest
  if (toc.length === 0) {
    const ncxItem = Object.values(manifest).find(
      (item) => item.mediaType === 'application/x-dtbncx+xml'
    );
    if (ncxItem) {
      const ncxPath = opfDir + ncxItem.href;
      const ncxContent = await zip.file(ncxPath)?.async('text');
      if (ncxContent) {
        toc = parseNcxToc(ncxContent);
      }
    }
  }

  // Update chapter titles from TOC if available
  updateChapterTitlesFromToc(chapters, toc);

  // Step 5: Extract images from manifest
  const images = await extractImages(zip, manifest, opfDir);

  return {
    metadata,
    chapters,
    toc,
    chapterCount: chapters.length,
    images,
    opfDir,
  };
}

/**
 * Extract the OPF file path from container.xml
 */
function extractOpfPath(containerXml: string): string | null {
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : null;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

interface ParsedOpf {
  metadata: EpubMetadata;
  manifest: Record<string, ManifestItem>;
  spine: string[];
  tocId: string | null;
}

/**
 * Parse the OPF file to extract metadata, manifest, and spine
 */
function parseOpf(opfContent: string): ParsedOpf {
  // Extract metadata
  const metadata: EpubMetadata = {
    title: extractTag(opfContent, 'dc:title') || 'Untitled',
    creator: extractTag(opfContent, 'dc:creator'),
    publisher: extractTag(opfContent, 'dc:publisher'),
    language: extractTag(opfContent, 'dc:language'),
    identifier: extractTag(opfContent, 'dc:identifier'),
    date: extractTag(opfContent, 'dc:date'),
    description: extractTag(opfContent, 'dc:description'),
  };

  // Extract manifest items
  const manifest: Record<string, ManifestItem> = {};
  const manifestRegex =
    /<item\s+([^>]*?)id="([^"]+)"([^>]*?)href="([^"]+)"([^>]*?)media-type="([^"]+)"([^>]*?)\/?>/gi;
  for (const manifestMatch of opfContent.matchAll(manifestRegex)) {
    const id = manifestMatch[2];
    const href = decodeURIComponent(manifestMatch[4]);
    const mediaType = manifestMatch[6];
    manifest[id] = { id, href, mediaType };
  }

  // Alternative manifest parsing (attributes in different order)
  const manifestRegex2 =
    /<item\s+([^>]*?)href="([^"]+)"([^>]*?)id="([^"]+)"([^>]*?)media-type="([^"]+)"([^>]*?)\/?>/gi;
  for (const manifestMatch of opfContent.matchAll(manifestRegex2)) {
    const href = decodeURIComponent(manifestMatch[2]);
    const id = manifestMatch[4];
    const mediaType = manifestMatch[6];
    if (!manifest[id]) {
      manifest[id] = { id, href, mediaType };
    }
  }

  // Extract spine
  const spine: string[] = [];
  const spineRegex = /<itemref\s+[^>]*idref="([^"]+)"[^>]*\/?>/gi;
  for (const spineMatch of opfContent.matchAll(spineRegex)) {
    spine.push(spineMatch[1]);
  }

  // Extract TOC reference
  let tocId: string | null = null;
  const tocMatch = opfContent.match(/<spine[^>]*toc="([^"]+)"/);
  if (tocMatch) {
    tocId = tocMatch[1];
  }
  // EPUB3: look for nav property
  const navMatch = opfContent.match(
    /<item[^>]*properties="[^"]*nav[^"]*"[^>]*id="([^"]+)"/
  );
  if (navMatch) {
    tocId = navMatch[1];
  }

  return { metadata, manifest, spine, tocId };
}

/**
 * Extract images from the EPUB manifest
 */
async function extractImages(
  zip: JSZip,
  manifest: Record<string, ManifestItem>,
  opfDir: string
): Promise<EpubImage[]> {
  const images: EpubImage[] = [];

  for (const item of Object.values(manifest)) {
    // Check if this is an image file
    if (!item.mediaType.startsWith('image/')) {
      continue;
    }

    const fullPath = opfDir + item.href;
    const file = zip.file(fullPath);
    if (!file) {
      continue;
    }

    try {
      const data = await file.async('nodebuffer');
      images.push({
        path: item.href,
        fullPath,
        data: Buffer.from(data),
        mediaType: item.mediaType,
      });
    } catch {
      // Skip images that fail to extract
      console.warn(`Failed to extract image: ${fullPath}`);
    }
  }

  return images;
}

/**
 * Extract a simple XML tag value
 */
function extractTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract plain text from HTML content
 */
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 10))
  );
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16))
  );

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Extract title from HTML content (from <title> or first <h1>)
 */
function extractTitleFromHtml(html: string): string | null {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try first <h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Parse NCX (EPUB2) table of contents
 */
function parseNcxToc(ncxContent: string): EpubTocItem[] {
  const toc: EpubTocItem[] = [];

  const navPointRegex =
    /<navPoint[^>]*id="([^"]*)"[^>]*>[\s\S]*?<navLabel>[\s\S]*?<text>([^<]*)<\/text>[\s\S]*?<content[^>]*src="([^"]*)"[^>]*\/?>/gi;

  for (const match of ncxContent.matchAll(navPointRegex)) {
    toc.push({
      id: match[1],
      title: match[2].trim(),
      href: decodeURIComponent(match[3]),
      children: [],
    });
  }

  return toc;
}

/**
 * Parse NAV (EPUB3) table of contents
 */
function parseNavToc(navContent: string): EpubTocItem[] {
  const toc: EpubTocItem[] = [];

  // Look for <nav epub:type="toc"> or <nav id="toc">
  const navMatch = navContent.match(
    /<nav[^>]*(?:epub:type="toc"|id="toc")[^>]*>([\s\S]*?)<\/nav>/i
  );
  if (!navMatch) return toc;

  const navHtml = navMatch[1];
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let id = 0;

  for (const match of navHtml.matchAll(linkRegex)) {
    toc.push({
      id: `nav-${id++}`,
      title: match[2].trim(),
      href: decodeURIComponent(match[1]),
      children: [],
    });
  }

  return toc;
}

/**
 * Update chapter titles from TOC entries
 */
function updateChapterTitlesFromToc(
  chapters: EpubChapter[],
  toc: EpubTocItem[]
): void {
  for (const tocItem of toc) {
    // Extract just the filename from href (remove fragments)
    const tocHref = tocItem.href.split('#')[0];

    for (const chapter of chapters) {
      if (chapter.href === tocHref || chapter.href.endsWith(tocHref)) {
        chapter.title = tocItem.title;
        break;
      }
    }
  }
}

/**
 * Convert TOC items to outline format compatible with document outline
 */
export function tocToOutline(
  toc: EpubTocItem[],
  chapters: EpubChapter[]
): EpubOutlineItem[] {
  const outline: EpubOutlineItem[] = [];
  let order = 0;

  function findSpineIndex(href: string): number {
    const hrefBase = href.split('#')[0];
    const chapter = chapters.find(
      (c) => c.href === hrefBase || c.href.endsWith(hrefBase)
    );
    return chapter?.spineIndex ?? 0;
  }

  function processItems(items: EpubTocItem[]): void {
    for (const item of items) {
      outline.push({
        title: item.title,
        spineIndex: findSpineIndex(item.href),
        order: order++,
      });
      if (item.children.length > 0) {
        processItems(item.children);
      }
    }
  }

  processItems(toc);
  return outline;
}
