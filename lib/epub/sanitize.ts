import DOMPurify from 'dompurify';
import { parseHTML } from 'linkedom';

// Create a virtual DOM window for server-side sanitization
const { window } = parseHTML('<!DOCTYPE html><html></html>');
const purify = DOMPurify(window as unknown as Window);

/**
 * EPUB-specific allowed tags that should be preserved during sanitization
 */
const ALLOWED_EPUB_TAGS = [
  // Standard HTML
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'a',
  'img',
  'figure',
  'figcaption',
  'blockquote',
  'pre',
  'code',
  'em',
  'strong',
  'i',
  'b',
  'u',
  's',
  'sub',
  'sup',
  'small',
  'mark',
  'abbr',
  'cite',
  'q',
  'dfn',
  'time',
  'var',
  'samp',
  'kbd',
  // Lists
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  // Tables
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  // EPUB-specific semantic elements
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'main',
  'address',
  // Media
  'audio',
  'video',
  'source',
  // Ruby annotations (for Asian languages)
  'ruby',
  'rt',
  'rp',
  'rb',
  'rtc',
];

/**
 * Allowed attributes for EPUB content
 */
const ALLOWED_ATTRS = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'lang',
  'dir',
  'epub:type',
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  // Table attributes
  'colspan',
  'rowspan',
  'scope',
  'headers',
  // Image dimensions
  'width',
  'height',
];

/**
 * Sanitize EPUB HTML content to prevent XSS while preserving EPUB semantics
 */
export function sanitizeEpubHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED_EPUB_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    // Allow data: URLs for embedded images
    ALLOW_DATA_ATTR: false,
    // Keep safe href protocols
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Remove dangerous elements completely
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    // Return as string
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}

/**
 * Extract and sanitize the body content from a full HTML document
 * This is useful for EPUB chapters that include full HTML with <head> and <body>
 */
export function extractAndSanitizeBody(html: string): string {
  // Try to extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;

  return sanitizeEpubHtml(content);
}

/**
 * Scope CSS classes to prevent style leakage
 * Prefixes all class names with 'epub-' to avoid conflicts
 */
export function scopeEpubClasses(html: string): string {
  return html.replace(/class="([^"]*)"/g, (match, classes) => {
    const scopedClasses = classes
      .split(/\s+/)
      .filter(Boolean)
      .map((cls: string) => `epub-${cls}`)
      .join(' ');
    return `class="${scopedClasses}"`;
  });
}

/**
 * Remove internal EPUB links (links to other chapters/files within the EPUB)
 * Keep external links (http, https, mailto, tel)
 */
export function removeInternalLinks(html: string): string {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  const links = Array.from(document.querySelectorAll('a[href]'));

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    // Keep external links (http, https, mailto, tel)
    const isExternal = /^(https?:|mailto:|tel:)/i.test(href);

    if (!isExternal) {
      // Replace link with its text content
      const span = document.createElement('span');
      span.innerHTML = (link as Element & { innerHTML: string }).innerHTML;
      link.replaceWith(span);
    }
  }

  return document.body.innerHTML;
}

/**
 * Convert figcaption elements to styled paragraphs
 * TipTap doesn't have a Figure extension, so we convert captions to italic small text
 */
export function styleFigcaptions(html: string): string {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  // Debug: log figure structure
  const figures = Array.from(document.querySelectorAll('figure'));
  if (figures.length > 0) {
    console.log('[Sanitize] Found figures:', figures.length);
    console.log('[Sanitize] First figure HTML:', (figures[0] as Element & { outerHTML: string }).outerHTML.slice(0, 500));
  }

  const figcaptions = Array.from(document.querySelectorAll('figcaption'));
  console.log('[Sanitize] Found figcaptions:', figcaptions.length);

  for (const figcaption of figcaptions) {
    const p = document.createElement('p');
    const content = (figcaption as Element & { innerHTML: string }).innerHTML.trim();
    // Wrap in small and em for visual distinction
    p.innerHTML = `<small><em>${content}</em></small>`;
    figcaption.replaceWith(p);
  }

  return document.body.innerHTML;
}

/**
 * Convert table-based poems/verse to line breaks
 * EPUBs often use tables with class="simplelist" or epub:type="list" for poems
 * Each <tr><td>line</td></tr> becomes a line with <br> at the end
 */
export function convertTablePoems(html: string): string {
  // Parse HTML using linkedom
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  // Find tables that look like poem/verse formatting
  const tables = Array.from(document.querySelectorAll('table.simplelist, table[epub\\:type="list"]'));

  for (const table of tables) {
    // Create a container div to hold the verse lines
    const container = document.createElement('div');
    container.setAttribute('class', 'verse');

    // Extract text from each table row
    const rows = Array.from(table.querySelectorAll('tr'));
    const lines: string[] = [];

    for (const row of rows) {
      const td = row.querySelector('td');
      if (td) {
        lines.push((td as Element & { innerHTML: string }).innerHTML.trim());
      }
    }

    // Join lines with <br> tags
    container.innerHTML = lines.join('<br>');

    // Replace table with container
    table.replaceWith(container);
  }

  // Return the body innerHTML
  return document.body.innerHTML;
}

/**
 * Full sanitization pipeline for EPUB chapter content
 */
export function sanitizeEpubChapter(html: string): string {
  const bodyContent = extractAndSanitizeBody(html);
  const withoutInternalLinks = removeInternalLinks(bodyContent);
  const withStyledCaptions = styleFigcaptions(withoutInternalLinks);
  const withConvertedTables = convertTablePoems(withStyledCaptions);
  return scopeEpubClasses(withConvertedTables);
}
