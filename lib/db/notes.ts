import 'server-only';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { documentNote as documentNoteTable } from './schema';
import type { DocumentNote } from './schema';
import type { DocumentType } from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export type { DocumentNote };

/**
 * Get or create a note for a document.
 * Returns the first note for the document (for single-notepad UX).
 */
export async function getOrCreateNote(
  userId: string,
  documentId: string,
  documentType: DocumentType
): Promise<DocumentNote> {
  // Try to find existing note
  const [existing] = await db
    .select()
    .from(documentNoteTable)
    .where(
      and(
        eq(documentNoteTable.userId, userId),
        eq(documentNoteTable.documentId, documentId)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new note
  const now = new Date();
  const [created] = await db
    .insert(documentNoteTable)
    .values({
      userId,
      documentId,
      documentType,
      content: '',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

/**
 * Get a note by ID
 */
export async function getNoteById(noteId: string): Promise<DocumentNote | null> {
  const [result] = await db
    .select()
    .from(documentNoteTable)
    .where(eq(documentNoteTable.id, noteId))
    .limit(1);
  return result ?? null;
}

/**
 * Update note content
 */
export async function updateNoteContent(
  noteId: string,
  userId: string,
  content: string
): Promise<DocumentNote | null> {
  const [result] = await db
    .update(documentNoteTable)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentNoteTable.id, noteId),
        eq(documentNoteTable.userId, userId)
      )
    )
    .returning();
  return result ?? null;
}

/**
 * Update note title (for future multi-note UI)
 */
export async function updateNoteTitle(
  noteId: string,
  userId: string,
  title: string
): Promise<DocumentNote | null> {
  const [result] = await db
    .update(documentNoteTable)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentNoteTable.id, noteId),
        eq(documentNoteTable.userId, userId)
      )
    )
    .returning();
  return result ?? null;
}

/**
 * Get all notes for a document (for future multi-note UI)
 */
export async function getNotesByDocument(
  userId: string,
  documentId: string
): Promise<DocumentNote[]> {
  return db
    .select()
    .from(documentNoteTable)
    .where(
      and(
        eq(documentNoteTable.userId, userId),
        eq(documentNoteTable.documentId, documentId)
      )
    );
}

/**
 * Delete a note
 */
export async function deleteNote(
  noteId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(documentNoteTable)
    .where(
      and(
        eq(documentNoteTable.id, noteId),
        eq(documentNoteTable.userId, userId)
      )
    )
    .returning({ id: documentNoteTable.id });
  return result.length > 0;
}
