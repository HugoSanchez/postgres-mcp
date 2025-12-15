/**
 * PDF Upload and Processing API Route
 *
 * This endpoint handles the complete workflow for uploading a PDF document:
 * 1. Authentication and authorization checks
 * 2. File validation (type, size)
 * 3. Deduplication via SHA-256 checksum
 * 4. Storage in Vercel Blob (for serving the original file)
 * 5. PDF parsing (extracting text, spans, and outline)
 * 6. Database persistence (document metadata, pages, outline)
 *
 * The route returns the document ID and blob URL so the client can:
 * - Render the PDF using the blob URL
 * - Reference the document by ID for notes, highlights, and chat
 */

import { put } from '@vercel/blob';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  createDocumentWithPages,
  findDocumentByChecksum,
} from '@/lib/db/documents';
import { parsePdf } from '@/lib/pdf/parse';
import type { ParsedPdf } from '@/lib/pdf/types';

// Maximum file size: 20MB
// This prevents memory issues during parsing and keeps uploads reasonable
const MAX_SIZE = 20 * 1024 * 1024;

/**
 * POST /api/upload/pdf
 *
 * Handles PDF file upload, parsing, and storage.
 *
 * Request body: FormData with a 'file' field containing the PDF file
 * Response: { documentId, blobUrl, numPages } or error
 */
export async function POST(request: Request) {
  // ============================================================================
  // STEP 1: Authentication & Authorization
  // ============================================================================
  // Verify the user is logged in. We need the user ID to:
  // - Associate the document with the user (for privacy/isolation)
  // - Track who uploaded what (for future features like sharing)
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ============================================================================
  // STEP 2: Extract and Validate File from FormData
  // ============================================================================
  // FormData is the standard way to upload files via HTTP POST
  // The client sends the file as multipart/form-data
  const formData = await request.formData();
  const file = formData.get('file');

  // Ensure we received a File object (not null, not a string, etc.)
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required.' }, { status: 400 });
  }

  // Validate file type: only PDFs are supported
  // This prevents users from uploading images, Word docs, etc.
  // The MIME type check is a first line of defense (can be spoofed, but helps)
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
  }

  // Validate file size: prevent memory exhaustion and DoS attacks
  // Large PDFs can cause the parsing step to consume too much memory
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  }

  // ============================================================================
  // STEP 3: Convert File to Buffer
  // ============================================================================
  // We need the file contents as a Buffer (Node.js binary data type) for:
  // - Computing checksum (deduplication)
  // - Uploading to Vercel Blob
  // - Parsing with pdfjs-dist
  // arrayBuffer() gives us the raw bytes, Buffer.from() wraps it in Node's Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // ============================================================================
    // STEP 4: Compute SHA-256 Checksum for Deduplication
    // ============================================================================
    // SHA-256 creates a unique fingerprint of the file's contents
    // Two identical files will have the same checksum, even if uploaded
    // by different users or with different filenames
    //
    // Why deduplication?
    // - Saves storage space (don't store the same PDF twice)
    // - Saves parsing time (don't re-parse identical files)
    // - Allows sharing: if User A uploads a PDF, User B can reference it
    //   without re-uploading (future feature)
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    // ============================================================================
    // STEP 5: Check for Existing Document (Deduplication)
    // ============================================================================
    // Before processing, check if we've already seen this exact file
    // If found, return the existing document info instead of re-processing
    const existingDoc = await findDocumentByChecksum(checksumSha256);
    if (existingDoc) {
      // Return existing document info
      // Note: We still return 200 (success) because the user's request
      // was fulfilled - they now have access to the document
      return NextResponse.json(
        {
          documentId: existingDoc.id,
          blobUrl: existingDoc.blobUrl,
          message: 'Document already exists',
        },
        { status: 200 },
      );
    }

    // ============================================================================
    // STEP 6: Upload to Vercel Blob Storage
    // ============================================================================
    // Store the original PDF file in Vercel Blob (object storage)
    // This is separate from our database because:
    // - Database is for structured data (metadata, parsed text)
    // - Blob storage is for binary files (the actual PDF)
    //
    // Why store the original PDF?
    // - Client-side rendering: We'll use pdfjs-dist in the browser to render
    //   the PDF with full fidelity (fonts, images, layout)
    // - Future features: Download, print, share original file
    // - Backup: If parsing fails or data is corrupted, we have the source
    //
    // The blob URL will be publicly accessible (access: 'public') so the
    // client can fetch it directly without authentication
    const blobResult = await put(`documents/${file.name}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    // ============================================================================
    // STEP 7: Parse PDF to Extract Structured Data
    // ============================================================================
    // Use pdfjs-dist to extract:
    // - Text content per page (for search, LLM context)
    // - Text spans with coordinates (for highlighting, note anchoring)
    // - Document outline/bookmarks (for navigation/TOC)
    //
    // This parsing happens server-side because:
    // - pdfjs-dist needs Node.js polyfills (DOMMatrix, etc.)
    // - Parsing is CPU-intensive, better to do on server
    // - We want to store parsed data in DB for fast retrieval
    //
    // The parsed data will be stored in the database so we don't need to
    // re-parse every time someone views the document
    const parsed: ParsedPdf = await parsePdf(buffer);

    // ============================================================================
    // STEP 8: Prepare Document Metadata for Database
    // ============================================================================
    // Create the main document record with:
    // - Unique ID (UUID v4)
    // - Timestamps (createdAt, updatedAt)
    // - File metadata (filename, size, MIME type)
    // - Storage info (blob URL, checksum)
    // - Parsed info (page count)
    // - User association (userId)
    const now = new Date();
    const document = {
      id: crypto.randomUUID(), // Generate a unique identifier
      createdAt: now,
      updatedAt: now,
      // Extract title from filename (remove .pdf extension)
      // e.g., "Hegel_Phenomenology.pdf" -> "Hegel_Phenomenology"
      title: file.name.replace(/\.pdf$/i, ''),
      originalFilename: file.name, // Keep original for reference
      mimeType: file.type, // "application/pdf"
      sizeBytes: file.size, // File size in bytes
      blobUrl: blobResult.url, // URL to fetch the PDF from Vercel Blob
      checksumSha256, // For deduplication
      pageCount: parsed.numPages, // Total number of pages
      userId: session.user.id, // Who uploaded it
    };

    // ============================================================================
    // STEP 9: Prepare Page Data for Database
    // ============================================================================
    // Each page gets its own database record with:
    // - Page index (0-based: 0, 1, 2, ...)
    // - Full text content (concatenated text for search/LLM)
    // - Text spans with coordinates (for highlighting, note anchoring)
    // - OCR flag (false for now, true if we OCR scanned pages later)
    //
    // Why store pages separately?
    // - Efficient pagination: Load pages on-demand as user scrolls
    // - Targeted queries: Search within specific pages
    // - Note anchoring: Pin notes to specific pages/spans
    const pages = parsed.pages.map((page) => ({
      documentId: document.id, // Link to parent document
      pageIndex: page.index, // Which page (0, 1, 2, ...)
      text: page.text, // Full text of the page
      spans: page.spans, // Array of { str, x, y, width, height, fontSize }
      hasOcr: false, // Not OCR'd yet (would be true for scanned PDFs)
      createdAt: now,
    }));

    // ============================================================================
    // STEP 10: Prepare Outline Data (if present)
    // ============================================================================
    // Some PDFs have a built-in table of contents (bookmarks/outline)
    // This is optional - many PDFs don't have one
    //
    // If present, store each outline item with:
    // - Title (e.g., "Chapter 1: Introduction")
    // - Page index (which page it links to)
    // - Order (for sorting/navigation)
    //
    // Why store the outline?
    // - Navigation sidebar: Show TOC in the reader UI
    // - Quick jumps: Let users jump to chapters/sections
    // - Better UX: Users can see document structure at a glance
    const outline = parsed.outline?.map((item, idx) => ({
      documentId: document.id, // Link to parent document
      title: item.title, // Chapter/section title
      pageIndex: item.pageIndex, // Which page this section starts on
      order: idx, // Order in the outline (0, 1, 2, ...)
      createdAt: now,
    }));

    // ============================================================================
    // STEP 11: Store Everything in Database (Transaction)
    // ============================================================================
    // Use a database transaction to ensure atomicity:
    // - Either ALL data is saved (document + pages + outline), or NONE
    // - Prevents partial saves if something fails mid-way
    //
    // The createDocumentWithPages function handles the transaction internally
    // and inserts all three types of records in the correct order
    await createDocumentWithPages({
      document,
      pages,
      outline,
    });

    // ============================================================================
    // STEP 12: Return Success Response
    // ============================================================================
    // Return the essential info the client needs:
    // - documentId: To fetch/display the document later
    // - blobUrl: To render the PDF in the browser
    // - numPages: To show progress, pagination, etc.
    //
    // The client will use these to:
    // 1. Store documentId in state/localStorage
    // 2. Fetch blobUrl to render PDF with pdfjs-dist
    // 3. Use numPages for pagination UI
    return NextResponse.json(
      {
        documentId: document.id,
        blobUrl: blobResult.url,
        numPages: parsed.numPages,
      },
      { status: 200 },
    );
  } catch (error) {
    // ============================================================================
    // ERROR HANDLING
    // ============================================================================
    // If anything fails (parsing, blob upload, database insert), log the error
    // and return a generic error message to the client
    //
    // In production, you might want to:
    // - Log to an error tracking service (Sentry, etc.)
    // - Return more specific error messages based on error type
    // - Clean up partial uploads (delete blob if DB insert fails)
    console.error('Failed to process PDF', error);
    return NextResponse.json(
      { error: 'Failed to process PDF.' },
      { status: 500 },
    );
  }
}

