/**
 * Reading Progress for Document API Route
 *
 * GET /api/reading-progress/[documentId]
 * Get reading progress for a specific document
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getReadingProgress } from '@/lib/db/reading-progress';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;

  try {
    const progress = await getReadingProgress(session.user.id, documentId);

    if (!progress) {
      return NextResponse.json({ progress: null });
    }

    return NextResponse.json({
      progress: {
        chapterIndex: progress.chapterIndex,
        scrollPosition: progress.scrollPosition,
        lastReadAt: progress.lastReadAt,
      },
    });
  } catch (error) {
    console.error('Failed to fetch reading progress', error);
    return NextResponse.json(
      { error: 'Failed to fetch reading progress' },
      { status: 500 }
    );
  }
}
