/**
 * Reading Progress API Route
 *
 * PUT /api/reading-progress
 * Upsert reading progress for a document
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { upsertReadingProgress } from '@/lib/db/reading-progress';
import type { DocumentType } from '@/lib/db/types';

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, documentType, chapterIndex, scrollPosition } = body;

    // Validate required fields
    if (!documentId || !documentType || scrollPosition === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, documentType, scrollPosition' },
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

    // Validate scrollPosition is between 0 and 1
    if (typeof scrollPosition !== 'number' || scrollPosition < 0 || scrollPosition > 1) {
      return NextResponse.json(
        { error: 'scrollPosition must be a number between 0 and 1' },
        { status: 400 }
      );
    }

    const progress = await upsertReadingProgress({
      userId: session.user.id,
      documentId,
      documentType,
      chapterIndex: chapterIndex ?? null,
      scrollPosition,
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Failed to update reading progress', error);
    return NextResponse.json(
      { error: 'Failed to update reading progress' },
      { status: 500 }
    );
  }
}
