import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  createAnnotation,
  getAnnotationsForDocument,
  getAnnotationsForSection,
  type CreateAnnotationInput,
} from '@/lib/db/annotations';

/**
 * POST /api/annotations
 * Create a new annotation
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, sectionIndex, type, selectedText, content, color, id } =
      body;

    // Validate required fields
    if (!documentId || sectionIndex === undefined || !type || !selectedText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['highlight', 'comment', 'ai-response', 'quote'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid annotation type' },
        { status: 400 }
      );
    }

    const input: CreateAnnotationInput = {
      id, // Optional - client can specify for TipTap mark sync
      documentId,
      sectionIndex,
      userId: session.user.id,
      type,
      selectedText,
      content,
      color,
    };

    const annotation = await createAnnotation(input);

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error('Failed to create annotation:', error);
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/annotations?documentId=xxx&sectionIndex=yyy
 * Get annotations for a document or section
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const sectionIndexStr = searchParams.get('sectionIndex');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    let annotations;
    if (sectionIndexStr !== null) {
      const sectionIndex = parseInt(sectionIndexStr, 10);
      if (isNaN(sectionIndex)) {
        return NextResponse.json(
          { error: 'Invalid sectionIndex' },
          { status: 400 }
        );
      }
      annotations = await getAnnotationsForSection(
        documentId,
        sectionIndex,
        session.user.id
      );
    } else {
      annotations = await getAnnotationsForDocument(
        documentId,
        session.user.id
      );
    }

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Failed to get annotations:', error);
    return NextResponse.json(
      { error: 'Failed to get annotations' },
      { status: 500 }
    );
  }
}
