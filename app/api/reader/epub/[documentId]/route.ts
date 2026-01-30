/**
 * EPUB Document API Route
 *
 * GET /api/epub/[documentId]
 * Returns the EPUB document metadata and chapter list
 *
 * GET /api/epub/[documentId]?chapter=0
 * Returns a specific chapter's content
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  getEpubWithChapters,
  getEpubChapter,
} from '@/lib/db/epub';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  // Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;
  const { searchParams } = new URL(request.url);
  const chapterParam = searchParams.get('chapter');

  try {
    // If chapter param is provided, return just that chapter
    if (chapterParam !== null) {
      const chapterIndex = Number.parseInt(chapterParam, 10);
      if (Number.isNaN(chapterIndex) || chapterIndex < 0) {
        return NextResponse.json(
          { error: 'Invalid chapter index' },
          { status: 400 }
        );
      }

      const chapter = await getEpubChapter(documentId, chapterIndex);
      if (!chapter) {
        return NextResponse.json(
          { error: 'Chapter not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        chapter: {
          id: chapter.id,
          spineIndex: chapter.spineIndex,
          href: chapter.href,
          title: chapter.title,
          html: chapter.html,
          text: chapter.text,
        },
      });
    }

    // Otherwise, return document metadata and chapter list
    const epub = await getEpubWithChapters(documentId);
    if (!epub) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Return document info with chapter metadata (without HTML content to keep response light)
    return NextResponse.json({
      document: {
        id: epub.doc.id,
        title: epub.doc.title,
        originalFilename: epub.doc.originalFilename,
        mimeType: epub.doc.mimeType,
        sizeBytes: epub.doc.sizeBytes,
        blobUrl: epub.doc.blobUrl,
        chapterCount: epub.chapters.length,
        createdAt: epub.doc.createdAt,
      },
      chapters: epub.chapters.map((ch) => ({
        id: ch.id,
        spineIndex: ch.spineIndex,
        href: ch.href,
        title: ch.title,
      })),
      outline: epub.outline.map((item) => ({
        id: item.id,
        title: item.title,
        pageIndex: item.pageIndex,
        order: item.order,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch EPUB', error);
    return NextResponse.json(
      { error: 'Failed to fetch EPUB' },
      { status: 500 }
    );
  }
}
