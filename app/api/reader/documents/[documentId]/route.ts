import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  deleteDocumentById,
  getDocumentById,
  renameDocument,
} from '@/lib/db/documents';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;

  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const doc = await getDocumentById(documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await renameDocument(documentId, title);
    return NextResponse.json({ document: updated }, { status: 200 });
  } catch (error) {
    console.error('Failed to rename document', error);
    return NextResponse.json(
      { error: 'Failed to rename document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;

  try {
    const doc = await getDocumentById(documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleted = await deleteDocumentById(documentId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete document', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
