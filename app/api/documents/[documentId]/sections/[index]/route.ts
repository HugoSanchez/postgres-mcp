import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  getDocumentSection,
  updateSectionContent,
} from '@/lib/db/document-sections';

/**
 * GET /api/documents/[documentId]/sections/[index]
 * Get a specific section
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string; index: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentId, index: indexStr } = await params;
    const index = parseInt(indexStr, 10);

    if (isNaN(index)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const section = await getDocumentSection(documentId, index);

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Failed to get section:', error);
    return NextResponse.json(
      { error: 'Failed to get section' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[documentId]/sections/[index]
 * Update a section's content (for saving annotation marks)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string; index: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentId, index: indexStr } = await params;
    const index = parseInt(indexStr, 10);

    if (isNaN(index)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const section = await updateSectionContent(documentId, index, content);

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Failed to update section:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}
