/**
 * Annotation API Route (Single Annotation)
 *
 * GET /api/reader/annotations/[id]
 * Gets a single annotation
 *
 * PATCH /api/reader/annotations/[id]
 * Updates an annotation's color or content
 *
 * DELETE /api/reader/annotations/[id]
 * Deletes an annotation
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  getAnnotationById,
  updateAnnotation,
  deleteAnnotation,
} from '@/lib/db/annotations';
import type { AnnotationColor, AnnotationContent } from '@/lib/db/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const annotation = await getAnnotationById(id);

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (annotation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Failed to fetch annotation', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { color, content } = body;

    // Validate that at least one field is being updated
    if (color === undefined && content === undefined) {
      return NextResponse.json(
        { error: 'At least one field (color or content) must be provided' },
        { status: 400 }
      );
    }

    // Validate color if provided
    const validColors: AnnotationColor[] = ['orange', 'yellow', 'green', 'blue', 'pink', 'purple'];
    if (color !== undefined && !validColors.includes(color)) {
      return NextResponse.json(
        { error: 'Invalid color. Must be: orange, yellow, green, blue, pink, or purple' },
        { status: 400 }
      );
    }

    const updateData: { color?: AnnotationColor; content?: AnnotationContent } = {};
    if (color !== undefined) updateData.color = color;
    if (content !== undefined) updateData.content = content;

    const annotation = await updateAnnotation(id, session.user.id, updateData);

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Failed to update annotation', error);
    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteAnnotation(id, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Annotation not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete annotation', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
