/**
 * Recent Reading Progress API Route
 *
 * GET /api/reading-progress/recent
 * Get recently read documents for the sidebar
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { getRecentReadingProgress } from '@/lib/db/reading-progress';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10), 20) : 5;

  try {
    const results = await getRecentReadingProgress(session.user.id, limit);

    return NextResponse.json({
      items: results.map(({ progress, document }) => ({
        documentId: progress.documentId,
        documentType: progress.documentType,
        title: document.title,
        chapterIndex: progress.chapterIndex,
        scrollPosition: progress.scrollPosition,
        lastReadAt: progress.lastReadAt,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch recent reading progress', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent reading progress' },
      { status: 500 }
    );
  }
}
