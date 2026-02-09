/**
 * Document Sections API Route
 *
 * GET /api/reader/epub/[documentId]
 * Returns the document metadata and section list
 *
 * GET /api/reader/epub/[documentId]?section=0
 * Returns a specific section's content (TipTap JSON)
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  getDocumentWithSections,
  getDocumentSection,
} from '@/lib/db/document-sections';

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
  // Support both 'section' and legacy 'chapter' param
  const sectionParam = searchParams.get('section') ?? searchParams.get('chapter');

  try {
    // If section param is provided, return just that section
    if (sectionParam !== null) {
      const sectionIndex = Number.parseInt(sectionParam, 10);
      if (Number.isNaN(sectionIndex) || sectionIndex < 0) {
        return NextResponse.json(
          { error: 'Invalid section index' },
          { status: 400 }
        );
      }

      const section = await getDocumentSection(documentId, sectionIndex);
      if (!section) {
        return NextResponse.json(
          { error: 'Section not found' },
          { status: 404 }
        );
      }

      // Debug: log section content structure
      console.log(`[API] Section ${sectionIndex} title:`, section.title);
      console.log(`[API] Section ${sectionIndex} content (first 500 chars):`, JSON.stringify(section.content).slice(0, 500));

      return NextResponse.json({
        section: {
          id: section.id,
          index: section.index,
          title: section.title,
          content: section.content, // TipTap JSON
          textContent: section.textContent,
        },
        // Legacy compatibility
        chapter: {
          id: section.id,
          spineIndex: section.index,
          href: '',
          title: section.title,
          content: section.content,
          text: section.textContent,
        },
      });
    }

    // Otherwise, return document metadata and section list
    const docData = await getDocumentWithSections(documentId);
    if (!docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Return document info with section metadata (without content to keep response light)
    return NextResponse.json({
      document: {
        id: docData.doc.id,
        title: docData.doc.title,
        originalFilename: docData.doc.originalFilename,
        mimeType: docData.doc.mimeType,
        sizeBytes: docData.doc.sizeBytes,
        blobUrl: docData.doc.blobUrl,
        sectionCount: docData.sections.length,
        // Legacy compatibility
        chapterCount: docData.sections.length,
        createdAt: docData.doc.createdAt,
      },
      sections: docData.sections.map((s) => ({
        id: s.id,
        index: s.index,
        title: s.title,
      })),
      // Legacy compatibility
      chapters: docData.sections.map((s) => ({
        id: s.id,
        spineIndex: s.index,
        href: '',
        title: s.title,
      })),
      outline: docData.outline.map((item) => ({
        id: item.id,
        title: item.title,
        pageIndex: item.pageIndex,
        order: item.order,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch document', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
