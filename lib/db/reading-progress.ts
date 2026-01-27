import 'server-only';

import { and, eq, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { readingProgress, document } from './schema';
import type { ReadingProgressRow, DocumentType } from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Upsert reading progress for a document
 */
export async function upsertReadingProgress(data: {
  userId: string;
  documentId: string;
  documentType: DocumentType;
  chapterIndex?: number | null;
  scrollPosition: number;
}): Promise<ReadingProgressRow> {
  const now = new Date();

  // Try to find existing progress
  const [existing] = await db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, data.userId),
        eq(readingProgress.documentId, data.documentId)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(readingProgress)
      .set({
        chapterIndex: data.chapterIndex,
        scrollPosition: data.scrollPosition,
        lastReadAt: now,
      })
      .where(eq(readingProgress.id, existing.id))
      .returning();
    return updated;
  }

  // Create new
  const [created] = await db
    .insert(readingProgress)
    .values({
      userId: data.userId,
      documentId: data.documentId,
      documentType: data.documentType,
      chapterIndex: data.chapterIndex,
      scrollPosition: data.scrollPosition,
      lastReadAt: now,
    })
    .returning();

  return created;
}

/**
 * Get reading progress for a specific document
 */
export async function getReadingProgress(
  userId: string,
  documentId: string
): Promise<ReadingProgressRow | null> {
  const [result] = await db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.documentId, documentId)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Get recent reading progress with document info for sidebar
 */
export async function getRecentReadingProgress(
  userId: string,
  limit = 5
): Promise<
  Array<{
    progress: ReadingProgressRow;
    document: { id: string; title: string };
  }>
> {
  const results = await db
    .select({
      progress: readingProgress,
      document: {
        id: document.id,
        title: document.title,
      },
    })
    .from(readingProgress)
    .innerJoin(document, eq(readingProgress.documentId, document.id))
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.lastReadAt))
    .limit(limit);

  return results;
}

/**
 * Delete reading progress for a document
 */
export async function deleteReadingProgress(
  userId: string,
  documentId: string
): Promise<boolean> {
  const result = await db
    .delete(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.documentId, documentId)
      )
    )
    .returning({ id: readingProgress.id });

  return result.length > 0;
}
