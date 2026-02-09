/**
 * EPUB Upload and Processing API Route
 *
 * This endpoint handles the complete workflow for uploading an EPUB document:
 * 1. Authentication and authorization checks
 * 2. File validation (type, size)
 * 3. Deduplication via SHA-256 checksum
 * 4. Storage in Vercel Blob (for serving the original file)
 * 5. EPUB parsing (extracting chapters, metadata, and TOC)
 * 6. HTML sanitization and TipTap JSON conversion
 * 7. Database persistence (document metadata, sections, outline)
 */

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { createDocumentWithSections } from '@/lib/db/document-sections';
import { findDocumentByChecksum } from '@/lib/db/documents';
import { parseEpub, tocToOutline } from '@/lib/epub/parse';
import { rewriteImageUrls } from '@/lib/epub/rewrite-urls';
import { sanitizeEpubChapter } from '@/lib/epub/sanitize';
import { ingestDocumentChunks } from '@/lib/rag/ingest';
import { processHtmlForStorage } from '@/lib/tiptap/html-to-json';

// Maximum file size: 20MB
const MAX_SIZE = 20 * 1024 * 1024;

/**
 * POST /api/upload/epub
 *
 * Handles EPUB file upload, parsing, and storage.
 *
 * Request body: FormData with a 'file' field containing the EPUB file
 * Response: { documentId, blobUrl, sectionCount } or error
 */
export async function POST(request: Request) {
  // ============================================================================
  // STEP 1: Authentication & Authorization
  // ============================================================================
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ============================================================================
  // STEP 2: Extract and Validate File from FormData
  // ============================================================================
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required.' }, { status: 400 });
  }

  // Validate file type: only EPUBs are supported
  // EPUB files have MIME type application/epub+zip
  if (file.type !== 'application/epub+zip') {
    return NextResponse.json(
      { error: 'Only EPUB files are supported.' },
      { status: 400 }
    );
  }

  // ============================================================================
  // STEP 3: Validate file size
  // ============================================================================
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  }

  // ============================================================================
  // STEP 4: Convert File to Buffer
  // ============================================================================
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // ============================================================================
    // STEP 5: Compute SHA-256 Checksum for Deduplication
    // ============================================================================
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    // ============================================================================
    // STEP 6: Check for Existing Document (Deduplication)
    // ============================================================================
    const existingDoc = await findDocumentByChecksum(checksumSha256);
    if (existingDoc) {
      return NextResponse.json(
        {
          documentId: existingDoc.id,
          blobUrl: existingDoc.blobUrl,
          message: 'Document already exists',
        },
        { status: 200 }
      );
    }

    // ============================================================================
    // STEP 7: Upload to Vercel Blob Storage
    // ============================================================================
    const blobResult = await put(`documents/${file.name}`, buffer, {
      access: 'public',
      contentType: 'application/epub+zip',
    });

    // ============================================================================
    // STEP 8: Parse EPUB to Extract Structured Data
    // ============================================================================
    const parsed = await parseEpub(buffer);

    // ============================================================================
    // STEP 9: Prepare Document Metadata for Database
    // ============================================================================
    const now = new Date();
    const documentId = crypto.randomUUID();
    const document = {
      id: documentId,
      createdAt: now,
      updatedAt: now,
      title: parsed.metadata.title || file.name.replace(/\.epub$/i, ''),
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      blobUrl: blobResult.url,
      checksumSha256,
      pageCount: parsed.chapterCount, // For EPUBs, this represents chapter count
      userId: session.user.id,
    };

    // ============================================================================
    // STEP 10: Upload Images to Blob Storage
    // ============================================================================
    const imageUrlMap: Record<string, string> = {};

    if (parsed.images.length > 0) {
      // Upload images in parallel (batch of 10 to avoid overwhelming)
      const batchSize = 10;
      for (let i = 0; i < parsed.images.length; i += batchSize) {
        const batch = parsed.images.slice(i, i + batchSize);
        const uploads = batch.map(async (image) => {
          const imagePath = `epub-images/${documentId}/${image.path}`;
          const result = await put(imagePath, image.data, {
            access: 'public',
            contentType: image.mediaType,
          });
          return { fullPath: image.fullPath, url: result.url };
        });

        const results = await Promise.all(uploads);
        for (const { fullPath, url } of results) {
          imageUrlMap[fullPath] = url;
        }
      }
    }

    // ============================================================================
    // STEP 11: Rewrite Image URLs, Convert to TipTap JSON, and Prepare Sections
    // ============================================================================
    const sections = parsed.chapters.map((chapter) => {
      // Rewrite image URLs to point to blob storage
      const htmlWithImages = rewriteImageUrls(
        chapter.html,
        chapter.href,
        parsed.opfDir,
        imageUrlMap
      );

      // Sanitize HTML and convert to TipTap JSON
      const sanitizedHtml = sanitizeEpubChapter(htmlWithImages);

      // Debug: log HTML for sections with "poem" in title
      if (chapter.title.toLowerCase().includes('poem')) {
        console.log(`[EPUB] Raw HTML for "${chapter.title}" (first 2000 chars):`, htmlWithImages.slice(0, 2000));
        console.log(`[EPUB] Sanitized HTML for "${chapter.title}" (first 2000 chars):`, sanitizedHtml.slice(0, 2000));
      }

      const { content, textContent } = processHtmlForStorage(sanitizedHtml);

      return {
        documentId: document.id,
        index: chapter.spineIndex,
        title: chapter.title,
        content,
        textContent,
        createdAt: now,
      };
    });

    // ============================================================================
    // STEP 12: Prepare Outline Data from TOC
    // ============================================================================
    const outlineItems = tocToOutline(parsed.toc, parsed.chapters);
    const outline = outlineItems.map((item) => ({
      documentId: document.id,
      title: item.title,
      pageIndex: item.spineIndex, // Map spine index to "page index" for compatibility
      order: item.order,
      createdAt: now,
    }));

    // ============================================================================
    // STEP 13: Store Everything in Database (Transaction)
    // ============================================================================
    await createDocumentWithSections({
      document,
      sections,
      outline: outline.length > 0 ? outline : undefined,
    });

    try {
      await ingestDocumentChunks({
        documentId: document.id,
        title: document.title,
        mimeType: document.mimeType,
        checksum: document.checksumSha256,
        sources: sections.map((section) => ({
          text: section.textContent,
          page: section.index,
        })),
      });
    } catch (error) {
      console.error('Failed to embed EPUB for RAG:', error);
    }

    // ============================================================================
    // STEP 14: Return Success Response
    // ============================================================================
    return NextResponse.json(
      {
        documentId: document.id,
        blobUrl: blobResult.url,
        sectionCount: sections.length,
        title: document.title,
        metadata: parsed.metadata,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to process EPUB', error);
    return NextResponse.json(
      { error: 'Failed to process EPUB.' },
      { status: 500 }
    );
  }
}
