/**
 * Annotations API Route
 *
 * POST /api/reader/annotations
 * Creates a new annotation
 *
 * GET /api/reader/annotations?documentId=X
 * Returns all annotations for a document
 *
 * GET /api/reader/annotations?documentId=X&chapterIndex=Y
 * Returns annotations for a specific chapter
 *
 * GET /api/reader/annotations?documentId=X&type=qa
 * Returns annotations of a specific type
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  createAnnotation,
  getAnnotationsByDocument,
  getAnnotationsByChapter,
} from '@/lib/db/annotations';
import type {
  EpubHighlightAnchor,
  AnnotationType,
  AnnotationColor,
  AnnotationContent,
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
  const typeParam = searchParams.get('type') as AnnotationType | null;

  if (!documentId) {
    return NextResponse.json(
      { error: 'documentId is required' },
      { status: 400 }
    );
  }

  // Validate type if provided
  const validTypes: AnnotationType[] = ['qa', 'comment', 'marker', 'note-quote'];
  if (typeParam && !validTypes.includes(typeParam)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be: qa, comment, marker, or note-quote' },
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

      const annotations = await getAnnotationsByChapter(
        documentId,
        chapterIndex,
        session.user.id,
        typeParam || undefined
      );
      return NextResponse.json({ annotations });
    }

    const annotations = await getAnnotationsByDocument(
      documentId,
      session.user.id,
      typeParam || undefined
    );
    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Failed to fetch annotations', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
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
    const { documentId, documentType, anchor, selectedText, type, content, color } = body;

    // Validate required fields
    if (!documentId || !documentType || !anchor || !selectedText || !type || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, documentType, anchor, selectedText, type, content' },
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

    // Validate type
    const validTypes: AnnotationType[] = ['qa', 'comment', 'marker', 'note-quote'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: qa, comment, marker, or note-quote' },
        { status: 400 }
      );
    }

    // Validate color if provided
    const validColors: AnnotationColor[] = ['orange', 'yellow', 'green', 'blue', 'pink', 'purple'];
    if (color && !validColors.includes(color)) {
      return NextResponse.json(
        { error: 'Invalid color. Must be: orange, yellow, green, blue, pink, or purple' },
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

    // Validate content structure based on type
    if (type === 'qa') {
      if (!content.question || !content.answer) {
        return NextResponse.json(
          { error: 'QA annotation requires question and answer in content' },
          { status: 400 }
        );
      }
    } else if (type === 'comment') {
      if (!content.text) {
        return NextResponse.json(
          { error: 'Comment annotation requires text in content' },
          { status: 400 }
        );
      }
    } else if (type === 'marker') {
      if (!content.symbol) {
        return NextResponse.json(
          { error: 'Marker annotation requires symbol in content' },
          { status: 400 }
        );
      }
    }
    // note-quote type accepts empty content object - the selectedText field stores the quote

    const annotation = await createAnnotation({
      documentId,
      documentType,
      userId: session.user.id,
      anchor,
      selectedText,
      type,
      content: content as AnnotationContent,
      color: color || 'orange',
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error('Failed to create annotation', error);
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    );
  }
}
