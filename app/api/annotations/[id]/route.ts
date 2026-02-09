import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
  userOwnsAnnotation,
} from '@/lib/db/annotations';

/**
 * GET /api/annotations/[id]
 * Get a single annotation
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const annotation = await getAnnotation(id);

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (annotation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Failed to get annotation:', error);
    return NextResponse.json(
      { error: 'Failed to get annotation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/annotations/[id]
 * Update an annotation
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { selectedText, content, color } = body;

    // Check ownership first
    const owns = await userOwnsAnnotation(id, session.user.id);
    if (!owns) {
      return NextResponse.json(
        { error: 'Annotation not found or forbidden' },
        { status: 404 }
      );
    }

    const annotation = await updateAnnotation(id, session.user.id, {
      selectedText,
      content,
      color,
    });

    if (!annotation) {
      return NextResponse.json(
        { error: 'Failed to update annotation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Failed to update annotation:', error);
    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotations/[id]
 * Delete an annotation
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteAnnotation(id, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Annotation not found or forbidden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete annotation:', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
