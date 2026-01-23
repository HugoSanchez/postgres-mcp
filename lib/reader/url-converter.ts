/**
 * URL Converter Utility
 *
 * Converts relative URLs in HTML content to absolute URLs.
 * This ensures images and links work correctly when displaying
 * extracted article content.
 *
 * Also configures all links to open in a new tab (target="_blank")
 * with security attributes (rel="noopener noreferrer").
 */

/**
 * Converts relative URLs in HTML to absolute URLs
 * @param html - The HTML string containing potentially relative URLs
 * @param baseUrl - The base URL to resolve relative URLs against
 * @returns HTML string with all relative URLs converted to absolute
 */
export function convertRelativeUrls(html: string, baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const baseOrigin = `${url.protocol}//${url.host}`;
    const basePath = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);

    // Convert relative URLs in img src attributes
    html = html.replace(
      /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
      (match, attributes, src) => {
        const absoluteSrc = resolveUrl(src, baseOrigin, basePath);
        return `<img${attributes} src="${absoluteSrc}"`;
      },
    );

    // Convert relative URLs in a href attributes and add target="_blank"
    html = html.replace(
      /<a([^>]*)\shref=["']([^"']+)["']/gi,
      (match, attributes, href) => {
        // Convert relative URLs to absolute (but keep mailto/tel/# as-is)
        let absoluteHref = href;
        if (
          !href.startsWith('http://') &&
          !href.startsWith('https://') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          !href.startsWith('#')
        ) {
          absoluteHref = resolveUrl(href, baseOrigin, basePath);
        }

        // Remove existing target and rel attributes if present
        const cleanAttributes = attributes
          .replace(/\starget=["'][^"']*["']/gi, '')
          .replace(/\srel=["'][^"']*["']/gi, '');

        // Add target="_blank" and rel="noopener noreferrer" for security
        return `<a${cleanAttributes} href="${absoluteHref}" target="_blank" rel="noopener noreferrer"`;
      },
    );

    // Handle srcset attributes (for responsive images)
    html = html.replace(
      /<img([^>]*)\ssrcset=["']([^"']+)["']/gi,
      (match, attributes, srcset) => {
        const absoluteSrcset = srcset
          .split(',')
          .map((src: string) => {
            const trimmed = src.trim();
            const parts = trimmed.split(/\s+/);
            if (parts[0]) {
              parts[0] = resolveUrl(parts[0], baseOrigin, basePath);
            }
            return parts.join(' ');
          })
          .join(', ');
        return `<img${attributes} srcset="${absoluteSrcset}"`;
      },
    );

    return html;
  } catch (error) {
    // If URL parsing fails, return original HTML
    console.error('Failed to convert relative URLs:', error);
    return html;
  }
}

/**
 * Resolves a relative URL to an absolute URL
 * @param url - The URL to resolve (can be relative or absolute)
 * @param baseOrigin - The base origin (e.g., "https://example.com")
 * @param basePath - The base path (e.g., "/articles/")
 * @returns Absolute URL
 */
function resolveUrl(url: string, baseOrigin: string, basePath: string): string {
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative URL (//example.com/path)
  if (url.startsWith('//')) {
    // Extract protocol from baseOrigin
    const protocol = new URL(baseOrigin).protocol;
    return `${protocol}${url}`;
  }

  // Absolute path (/path/to/resource)
  if (url.startsWith('/')) {
    return `${baseOrigin}${url}`;
  }

  // Relative path (path/to/resource or ../path/to/resource)
  // Simple resolution: append to basePath
  const resolvedPath = basePath + url;
  return `${baseOrigin}${resolvedPath}`;
}

