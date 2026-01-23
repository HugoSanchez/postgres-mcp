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
 * Full sanitization pipeline for EPUB chapter content
 */
export function sanitizeEpubChapter(html: string): string {
  const bodyContent = extractAndSanitizeBody(html);
  return scopeEpubClasses(bodyContent);
}
