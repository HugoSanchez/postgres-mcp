/**
 * Notes API Route
 *
 * GET /api/reader/notes?documentId=X&documentType=epub
 * Gets or creates a note for the document (returns the first/only note)
 *
 * PATCH /api/reader/notes
 * Updates note content
 * Body: { noteId, content }
 *
 * POST /api/reader/notes (same as PATCH - for sendBeacon compatibility)
 * Updates note content
 * Body: { noteId, content }
 */

import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  getOrCreateNote,
  updateNoteContent,
} from '@/lib/db/notes';
import type { DocumentType } from '@/lib/db/types';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const documentType = searchParams.get('documentType') as DocumentType | null;

  if (!documentId) {
    return NextResponse.json(
      { error: 'documentId is required' },
      { status: 400 }
    );
  }

  if (!documentType) {
    return NextResponse.json(
      { error: 'documentType is required' },
      { status: 400 }
    );
  }

  const validDocumentTypes: DocumentType[] = ['epub', 'pdf', 'article'];
  if (!validDocumentTypes.includes(documentType)) {
    return NextResponse.json(
      { error: 'Invalid documentType. Must be: epub, pdf, or article' },
      { status: 400 }
    );
  }

  try {
    const note = await getOrCreateNote(
      session.user.id,
      documentId,
      documentType
    );
    return NextResponse.json({ note });
  } catch (error) {
    console.error('Failed to get/create note', error);
    return NextResponse.json(
      { error: 'Failed to get note' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, content } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: 'noteId is required' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content must be a string' },
        { status: 400 }
      );
    }

    const note = await updateNoteContent(noteId, session.user.id, content);

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Failed to update note', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

// POST handler for sendBeacon (which can't use PATCH)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, content } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: 'noteId is required' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content must be a string' },
        { status: 400 }
      );
    }

    const note = await updateNoteContent(noteId, session.user.id, content);

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Failed to update note', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}
