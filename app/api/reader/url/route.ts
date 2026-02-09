/**
 * Article URL Reader API Route
 *
 * This endpoint handles fetching and extracting article content from URLs:
 * 1. Validates the URL format
 * 2. Fetches HTML from the URL
 * 3. Extracts main content using Mozilla Readability
 * 4. Converts relative URLs to absolute URLs
 * 5. Sanitizes HTML for safe rendering
 * 6. Returns structured article data
 */

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import createDOMPurify from 'dompurify';
import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

import { auth } from '@/app/(auth)/auth';
import { createDocumentWithSections } from '@/lib/db/document-sections';
import { findDocumentByChecksum } from '@/lib/db/documents';
import { convertRelativeUrls } from '@/lib/reader/url-converter';
import { ingestDocumentChunks } from '@/lib/rag/ingest';
import { processHtmlForStorage } from '@/lib/tiptap/html-to-json';

// Maximum content length to prevent memory issues (10MB)
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;
const MAX_IMAGES = 25;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_BATCH_SIZE = 8;

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

/**
 * POST /api/reader/url
 *
 * Fetches and extracts article content from a URL.
 *
 * Request body: { url: string }
 * Response: { title, content, byline, excerpt, url } or error
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================================================
    // STEP 1: Parse and Validate Request Body
    // ============================================================================
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required and must be a string.' },
        { status: 400 },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: 'Only HTTP and HTTPS URLs are supported.' },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format.' },
        { status: 400 },
      );
    }

    // ============================================================================
    // STEP 2: Fetch HTML from URL
    // ============================================================================
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let html: string;
    let finalUrl = url;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          {
            error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
          },
          { status: response.status },
        );
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number.parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: 'Content is too large to process.' },
          { status: 413 },
        );
      }

      finalUrl = response.url || url;
      html = await response.text();

      // Check actual content length
      if (html.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: 'Content is too large to process.' },
          { status: 413 },
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout. The URL took too long to respond.' },
          { status: 408 },
        );
      }
      throw error;
    }

    // ============================================================================
    // STEP 3: Deduplicate by canonical URL (per user)
    // ============================================================================
    const checksumSha256 = createHash('sha256')
      .update(finalUrl)
      .digest('hex');
    const existingDoc = await findDocumentByChecksum(checksumSha256);
    if (existingDoc && existingDoc.userId === session.user.id) {
      return NextResponse.json(
        { documentId: existingDoc.id, title: existingDoc.title },
        { status: 200 }
      );
    }

    // ============================================================================
    // STEP 4: Parse HTML with linkedom
    // ============================================================================
    // linkedom is a lighter, faster alternative to jsdom that works better with Next.js
    const { document, window } = parseHTML(html);

    // ============================================================================
    // STEP 5: Extract Article Content with Readability
    // ============================================================================
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json(
        { error: 'Could not extract article content from this URL.' },
        { status: 422 },
      );
    }

    // ============================================================================
    // STEP 5.5: Preserve tables - Readability sometimes converts them
    // ============================================================================
    let finalContent = article.content;

    // Check if tables exist in extracted content
    const extractedDoc = parseHTML(article.content).document;
    const tablesInExtracted = extractedDoc.querySelectorAll('table');

    // If no tables found, Readability likely converted them
    // Find tables from original document and try to restore them intelligently
    if (tablesInExtracted.length === 0) {
      const allOriginalTables = Array.from(document.querySelectorAll('table'));

      if (allOriginalTables.length > 0) {
        // Try to find where tables should go by looking for table-related text
        // This is a heuristic approach - look for text that might indicate a table location
        const tableTexts = allOriginalTables.map((table) => {
          const text = table.textContent?.trim().substring(0, 100) || '';
          return text;
        });

        // For each table, try to find a matching location in the extracted content
        // by looking for nearby text content
        const contentDoc = parseHTML(`<div>${article.content}</div>`).document;
        const paragraphs = Array.from(contentDoc.querySelectorAll('p, div'));

        allOriginalTables.forEach((table, index) => {
          const tableText = tableTexts[index];
          if (tableText) {
            // Find paragraph that might be near this table
            const matchingPara = paragraphs.find((p) => {
              const paraText = p.textContent?.trim() || '';
              // Check if paragraph text contains some words from table
              const tableWords = tableText.split(/\s+/).slice(0, 5);
              return tableWords.some((word) =>
                word.length > 3 && paraText.includes(word)
              );
            });

            if (matchingPara) {
              // Insert table after matching paragraph
              const tableHtml = table.outerHTML;
              matchingPara.insertAdjacentHTML('afterend', tableHtml);
            }
          }
        });

        // Update finalContent with inserted tables
        finalContent = contentDoc.documentElement.innerHTML;
        // Remove the wrapper div we added
        finalContent = finalContent.replace(/^<div>|<\/div>$/g, '');
      }
    }

    // ============================================================================
    // STEP 6: Convert Relative URLs to Absolute URLs
    // ============================================================================
    const contentWithAbsoluteUrls = convertRelativeUrls(finalContent, finalUrl);

    // ============================================================================
    // STEP 7: Download/Proxy Images into Blob and Rewrite URLs
    // ============================================================================
    const { document: contentDoc } = parseHTML(
      `<div id="content-root">${contentWithAbsoluteUrls}</div>`
    );
    const container = contentDoc.getElementById('content-root');

    if (container) {
      normalizeEscapedBlockquotes(container);
    }

    const imageElements = Array.from(container?.querySelectorAll('img') || []);
    const imageUrls = imageElements
      .map((img) => img.getAttribute('src') || '')
      .filter((src) => src.startsWith('http://') || src.startsWith('https://'))
      .filter((src, index, arr) => arr.indexOf(src) === index)
      .slice(0, MAX_IMAGES);

    const imageUrlMap: Record<string, string> = {};
    const imageId = randomUUID();

    for (let i = 0; i < imageUrls.length; i += IMAGE_BATCH_SIZE) {
      const batch = imageUrls.slice(i, i + IMAGE_BATCH_SIZE);
      const uploads = batch.map(async (imageUrl, index) => {
        try {
          const response = await fetch(imageUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          });

          if (!response.ok) return null;

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.startsWith('image/')) return null;

          const contentLength = response.headers.get('content-length');
          if (contentLength && Number.parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
            return null;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > MAX_IMAGE_BYTES) return null;

          const ext = contentType.split('/')[1]?.split(';')[0] || 'img';
          const imagePath = `article-images/${imageId}/${i + index}.${ext}`;
          const result = await put(imagePath, buffer, {
            access: 'public',
            contentType,
          });
          return { imageUrl, blobUrl: result.url };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(uploads);
      for (const result of results) {
        if (result) {
          imageUrlMap[result.imageUrl] = result.blobUrl;
        }
      }
    }

    for (const img of imageElements) {
      const src = img.getAttribute('src') || '';
      const blobUrl = imageUrlMap[src];
      if (blobUrl) {
        img.setAttribute('src', blobUrl);
        img.removeAttribute('srcset');
      }
    }

    const contentWithImages = container
      ? container.innerHTML
      : contentWithAbsoluteUrls;

    // ============================================================================
    // STEP 8: Sanitize HTML for Safe Rendering
    // ============================================================================
    // Configure DOMPurify to work with linkedom's window object
    const DOMPurify = createDOMPurify(window as unknown as Window);

    // Allow common article elements but strip dangerous content
    const sanitizedContent = DOMPurify.sanitize(contentWithImages, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'b',
        'i',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'a',
        'img',
        'figure',
        'figcaption',
        'hr',
        'div',
        'span',
        // Table elements
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'td',
        'th',
        'caption',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'srcset',
        'sizes',
        // Table attributes
        'colspan',
        'rowspan',
        'scope',
        'headers',
        'abbr',
        'axis',
        'align',
        'valign',
        'width',
        'height',
      ],
      ALLOW_DATA_ATTR: false,
    });

    // ============================================================================
    // STEP 9: Convert to TipTap JSON and Persist as Document Section
    // ============================================================================
    const now = new Date();
    const documentId = randomUUID();

    // Convert sanitized HTML to TipTap JSON
    const { content, textContent } = processHtmlForStorage(sanitizedContent);

    await createDocumentWithSections({
      document: {
        id: documentId,
        createdAt: now,
        updatedAt: now,
        title: article.title || 'Untitled',
        originalFilename: finalUrl,
        mimeType: 'text/html',
        sizeBytes: html.length,
        blobUrl: null,
        checksumSha256,
        pageCount: 1,
        userId: session.user.id,
      },
      sections: [
        {
          documentId,
          index: 0,
          title: article.title || 'Untitled',
          content,
          textContent,
          createdAt: now,
        },
      ],
    });

    try {
      await ingestDocumentChunks({
        documentId,
        title: article.title || 'Untitled',
        mimeType: 'text/html',
        checksum: checksumSha256,
        sources: [
          {
            text: textContent,
            page: 0,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to embed article for RAG:', error);
    }

    return NextResponse.json(
      {
        documentId,
        title: article.title || 'Untitled',
        url: finalUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    // ============================================================================
    // ERROR HANDLING
    // ============================================================================
    console.error('Failed to process URL:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process URL. Please try again.',
      },
      { status: 500 },
    );
  }
}

function normalizeEscapedBlockquotes(container: HTMLElement) {
  const children = Array.from(container.childNodes);
  const output: Node[] = [];
  const doc = container.ownerDocument || container;

  const isMarker = (node: Node, marker: string) => {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.closest('code, pre')) return false;
      const text = el.textContent?.trim().toLowerCase();
      return text === marker;
    }
    if (node.nodeType === 3) {
      const text = node.textContent?.trim().toLowerCase();
      return text === marker;
    }
    return false;
  };

  let i = 0;
  while (i < children.length) {
    const node = children[i];

    if (isMarker(node, '<blockquote>')) {
      const blockquote = doc.createElement('blockquote');
      i += 1;
      while (i < children.length && !isMarker(children[i], '</blockquote>')) {
        blockquote.appendChild(children[i]);
        i += 1;
      }
      if (i < children.length && isMarker(children[i], '</blockquote>')) {
        i += 1;
      }
      output.push(blockquote);
      continue;
    }

    output.push(node);
    i += 1;
  }

  container.innerHTML = '';
  for (const node of output) {
    container.appendChild(node);
  }
}
