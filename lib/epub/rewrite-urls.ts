/**
 * Rewrite image URLs in EPUB chapter HTML to point to uploaded blob URLs
 */

/**
 * Resolves a relative path against a base path
 * e.g., resolveRelativePath("../images/cover.jpg", "OEBPS/Text/chapter1.html")
 *       returns "OEBPS/images/cover.jpg"
 */
function resolveRelativePath(relativePath: string, basePath: string): string {
  // Get the directory of the base path
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);

  // Handle absolute paths (starting with /)
  if (relativePath.startsWith('/')) {
    return relativePath.slice(1);
  }

  // Split the relative path into segments
  const segments = (baseDir + relativePath).split('/');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      resolved.pop();
    } else if (segment !== '.' && segment !== '') {
      resolved.push(segment);
    }
  }

  return resolved.join('/');
}

/**
 * Rewrite image src URLs in HTML to use blob URLs
 *
 * @param html - The chapter HTML content
 * @param chapterHref - The chapter's href (e.g., "Text/chapter1.xhtml")
 * @param opfDir - The OPF directory (e.g., "OEBPS/")
 * @param urlMap - Map of full image paths to blob URLs
 * @returns HTML with rewritten image URLs
 */
export function rewriteImageUrls(
  html: string,
  chapterHref: string,
  opfDir: string,
  urlMap: Record<string, string>
): string {
  // The chapter's full path within the EPUB
  const chapterFullPath = opfDir + chapterHref;

  // Match img tags with src attributes
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      // Skip data URLs and absolute URLs
      if (src.startsWith('data:') || src.startsWith('http')) {
        return match;
      }

      // Resolve the relative path to get the full path within the EPUB
      const resolvedPath = resolveRelativePath(src, chapterFullPath);

      // Look up the blob URL
      const blobUrl = urlMap[resolvedPath];

      if (blobUrl) {
        return `<img${before} src="${blobUrl}"${after}>`;
      }

      // If no mapping found, return original (will show broken image)
      return match;
    }
  );
}

/**
 * Rewrite all image URLs in an array of chapters
 */
export function rewriteChapterImageUrls(
  chapters: Array<{ href: string; html: string }>,
  opfDir: string,
  urlMap: Record<string, string>
): void {
  for (const chapter of chapters) {
    chapter.html = rewriteImageUrls(
      chapter.html,
      chapter.href,
      opfDir,
      urlMap
    );
  }
}
