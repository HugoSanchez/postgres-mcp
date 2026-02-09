/**
 * PDF Upload and Processing API Route
 *
 * This endpoint handles the complete workflow for uploading a PDF document:
 * 1. Authentication and authorization checks
 * 2. File validation (type, size)
 * 3. Deduplication via SHA-256 checksum
 * 4. Storage in Vercel Blob (for serving the original file)
 * 5. Convert PDF to HTML via ConvertAPI
 * 6. Convert HTML to TipTap JSON
 * 7. Database persistence (document metadata, sections)
 */

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { createDocumentWithSections } from '@/lib/db/document-sections';
import { findDocumentByChecksum } from '@/lib/db/documents';
import { sanitizeEpubChapter } from '@/lib/epub/sanitize';
import { ingestDocumentChunks } from '@/lib/rag/ingest';
import { convertPdfToHtml } from '@/lib/pdf/convertapi';
import { processHtmlForStorage } from '@/lib/tiptap/html-to-json';

export const maxDuration = 300;

// Maximum file size: 20MB
const MAX_SIZE = 20 * 1024 * 1024;

/**
 * POST /api/upload/pdf
 *
 * Handles PDF file upload, conversion, and storage.
 *
 * Request body: FormData with a 'file' field containing the PDF file
 * Response: { documentId, blobUrl, sectionCount } or error
 */
export async function POST(request: Request) {
  // ==========================================================================
  // STEP 1: Authentication & Authorization
  // ==========================================================================
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ==========================================================================
  // STEP 2: Extract and Validate File from FormData
  // ==========================================================================
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required.' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are supported.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  }

  // ==========================================================================
  // STEP 3: Convert File to Buffer
  // ==========================================================================
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // ========================================================================
    // STEP 4: Compute SHA-256 Checksum for Deduplication
    // ========================================================================
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    // ========================================================================
    // STEP 5: Check for Existing Document (Deduplication)
    // ========================================================================
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

    // ========================================================================
    // STEP 6: Upload to Vercel Blob Storage
    // ========================================================================
    const blobResult = await put(`documents/${file.name}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    // ========================================================================
    // STEP 7: Convert PDF to HTML
    // ========================================================================
    const rawHtml = await convertPdfToHtml(buffer, file.name, {
      wysiwyg: false,
      ocrMode: 'force',
    });

    const sanitizedHtml = sanitizeEpubChapter(rawHtml);

    // ========================================================================
    // STEP 8: Convert HTML to TipTap JSON
    // ========================================================================
    const { content, textContent } = processHtmlForStorage(sanitizedHtml);

    if (!textContent) {
      return NextResponse.json(
        { error: 'No text could be extracted from this PDF.' },
        { status: 422 }
      );
    }

    // ========================================================================
    // STEP 9: Prepare Document + Section Data
    // ========================================================================
    const now = new Date();
    const documentId = crypto.randomUUID();
    const title = file.name.replace(/\.pdf$/i, '');

    const document = {
      id: documentId,
      createdAt: now,
      updatedAt: now,
      title,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      blobUrl: blobResult.url,
      checksumSha256,
      pageCount: 1,
      userId: session.user.id,
    };

    const sections = [
      {
        documentId: document.id,
        index: 0,
        title: document.title,
        content,
        textContent,
        createdAt: now,
      },
    ];

    // ========================================================================
    // STEP 10: Store Everything in Database
    // ========================================================================
    await createDocumentWithSections({ document, sections });

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
      console.error('Failed to embed PDF for RAG:', error);
    }

    // ========================================================================
    // STEP 11: Return Success Response
    // ========================================================================
    return NextResponse.json(
      {
        documentId: document.id,
        blobUrl: blobResult.url,
        sectionCount: sections.length,
        title: document.title,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to process PDF', error);
    return NextResponse.json(
      { error: 'Failed to process PDF.' },
      { status: 500 }
    );
  }
}
