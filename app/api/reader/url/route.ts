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

import { convertRelativeUrls } from '@/lib/reader/url-converter';

// Maximum content length to prevent memory issues (10MB)
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

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
    // STEP 3: Parse HTML with linkedom
    // ============================================================================
    // linkedom is a lighter, faster alternative to jsdom that works better with Next.js
    const { document, window } = parseHTML(html);

    // ============================================================================
    // STEP 4: Extract Article Content with Readability
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
    // STEP 4.5: Preserve tables - Readability sometimes converts them
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
    // STEP 5: Convert Relative URLs to Absolute URLs
    // ============================================================================
    const contentWithAbsoluteUrls = convertRelativeUrls(finalContent, url);

    // ============================================================================
    // STEP 6: Sanitize HTML for Safe Rendering
    // ============================================================================
    // Configure DOMPurify to work with linkedom's window object
    const DOMPurify = createDOMPurify(window as unknown as Window);

    // Allow common article elements but strip dangerous content
    const sanitizedContent = DOMPurify.sanitize(contentWithAbsoluteUrls, {
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
    // STEP 7: Return Structured Article Data
    // ============================================================================
    return NextResponse.json(
      {
        title: article.title || 'Untitled',
        content: sanitizedContent,
        byline: article.byline || null,
        excerpt: article.excerpt || null,
        url: url,
        length: article.length || 0,
      },
      { status: 200 },
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

