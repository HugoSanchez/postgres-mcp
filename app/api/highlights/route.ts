/**
 * Highlights API Route
 *
 * POST /api/highlights
 * Creates a new highlight
 *
 * GET /api/highlights?documentId=X
 * Returns all highlights for a document
 *
 * GET /api/highlights?documentId=X&chapterIndex=Y
 * Returns highlights for a specific chapter
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  createHighlight,
  getHighlightsByDocument,
  getHighlightsByChapter,
} from '@/lib/db/highlights';
import type {
  EpubHighlightAnchor,
  HighlightColor,
  DocumentType,
} from '@/lib/db/types';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const chapterIndexParam = searchParams.get('chapterIndex');

  if (!documentId) {
    return NextResponse.json(
      { error: 'documentId is required' },
      { status: 400 }
    );
  }

  try {
    if (chapterIndexParam !== null) {
      const chapterIndex = Number.parseInt(chapterIndexParam, 10);
      if (Number.isNaN(chapterIndex) || chapterIndex < 0) {
        return NextResponse.json(
          { error: 'Invalid chapterIndex' },
          { status: 400 }
        );
      }

      const highlights = await getHighlightsByChapter(
        documentId,
        chapterIndex,
        session.user.id
      );
      return NextResponse.json({ highlights });
    }

    const highlights = await getHighlightsByDocument(documentId, session.user.id);
    return NextResponse.json({ highlights });
  } catch (error) {
    console.error('Failed to fetch highlights', error);
    return NextResponse.json(
      { error: 'Failed to fetch highlights' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, documentType, anchor, selectedText, color, note } = body;

    // Validate required fields
    if (!documentId || !documentType || !anchor || !selectedText) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, documentType, anchor, selectedText' },
        { status: 400 }
      );
    }

    // Validate documentType
    const validDocumentTypes: DocumentType[] = ['epub', 'pdf', 'article'];
    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid documentType. Must be: epub, pdf, or article' },
        { status: 400 }
      );
    }

    // Validate color if provided
    const validColors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple'];
    if (color && !validColors.includes(color)) {
      return NextResponse.json(
        { error: 'Invalid color. Must be: yellow, green, blue, pink, or purple' },
        { status: 400 }
      );
    }

    // Validate EPUB anchor structure
    if (documentType === 'epub') {
      const epubAnchor = anchor as EpubHighlightAnchor;
      if (
        typeof epubAnchor.chapterIndex !== 'number' ||
        typeof epubAnchor.startOffset !== 'number' ||
        typeof epubAnchor.endOffset !== 'number'
      ) {
        return NextResponse.json(
          { error: 'Invalid anchor structure for EPUB. Required: chapterIndex, startOffset, endOffset' },
          { status: 400 }
        );
      }
    }

    const highlight = await createHighlight({
      documentId,
      documentType,
      userId: session.user.id,
      anchor,
      selectedText,
      color: color || 'yellow',
      note,
    });

    return NextResponse.json({ highlight }, { status: 201 });
  } catch (error) {
    console.error('Failed to create highlight', error);
    return NextResponse.json(
      { error: 'Failed to create highlight' },
      { status: 500 }
    );
  }
}
