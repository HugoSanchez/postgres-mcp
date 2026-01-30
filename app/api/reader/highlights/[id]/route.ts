/**
 * Highlight API Route (Single Highlight)
 *
 * PATCH /api/highlights/[id]
 * Updates a highlight's color or note
 *
 * DELETE /api/highlights/[id]
 * Deletes a highlight
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  updateHighlight,
  deleteHighlight,
} from '@/lib/db/highlights';
import type { HighlightColor } from '@/lib/db/types';

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
    const { color, note } = body;

    // Validate that at least one field is being updated
    if (color === undefined && note === undefined) {
      return NextResponse.json(
        { error: 'At least one field (color or note) must be provided' },
        { status: 400 }
      );
    }

    // Validate color if provided
    const validColors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple'];
    if (color !== undefined && !validColors.includes(color)) {
      return NextResponse.json(
        { error: 'Invalid color. Must be: yellow, green, blue, pink, or purple' },
        { status: 400 }
      );
    }

    const updateData: { color?: HighlightColor; note?: string } = {};
    if (color !== undefined) updateData.color = color;
    if (note !== undefined) updateData.note = note;

    const highlight = await updateHighlight(id, session.user.id, updateData);

    if (!highlight) {
      return NextResponse.json(
        { error: 'Highlight not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ highlight });
  } catch (error) {
    console.error('Failed to update highlight', error);
    return NextResponse.json(
      { error: 'Failed to update highlight' },
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
    const deleted = await deleteHighlight(id, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Highlight not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete highlight', error);
    return NextResponse.json(
      { error: 'Failed to delete highlight' },
      { status: 500 }
    );
  }
}
