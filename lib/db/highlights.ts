import 'server-only';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { highlight as highlightTable } from './schema';
import type {
  HighlightRow,
  EpubHighlightAnchor,
  HighlightColor,
  DocumentType,
} from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Create a new highlight
 */
export async function createHighlight(data: {
  documentId: string;
  documentType: DocumentType;
  userId: string;
  anchor: EpubHighlightAnchor;
  selectedText: string;
  color: HighlightColor;
  note?: string;
}): Promise<HighlightRow> {
  const now = new Date();
  const [result] = await db
    .insert(highlightTable)
    .values({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return result;
}

/**
 * Get all highlights for a document and chapter
 */
export async function getHighlightsByChapter(
  documentId: string,
  chapterIndex: number,
  userId: string
): Promise<HighlightRow[]> {
  const highlights = await db
    .select()
    .from(highlightTable)
    .where(
      and(
        eq(highlightTable.documentId, documentId),
        eq(highlightTable.userId, userId)
      )
    );

  // Filter by chapter index from the JSONB anchor field
  return highlights.filter((h) => {
    const anchor = h.anchor as EpubHighlightAnchor;
    return anchor.chapterIndex === chapterIndex;
  });
}

/**
 * Get all highlights for a document (all chapters)
 */
export async function getHighlightsByDocument(
  documentId: string,
  userId: string
): Promise<HighlightRow[]> {
  return db
    .select()
    .from(highlightTable)
    .where(
      and(
        eq(highlightTable.documentId, documentId),
        eq(highlightTable.userId, userId)
      )
    );
}

/**
 * Get a single highlight by ID
 */
export async function getHighlightById(
  highlightId: string
): Promise<HighlightRow | null> {
  const [result] = await db
    .select()
    .from(highlightTable)
    .where(eq(highlightTable.id, highlightId))
    .limit(1);
  return result ?? null;
}

/**
 * Update a highlight (color or note)
 */
export async function updateHighlight(
  highlightId: string,
  userId: string,
  data: { color?: HighlightColor; note?: string }
): Promise<HighlightRow | null> {
  const [result] = await db
    .update(highlightTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(highlightTable.id, highlightId),
        eq(highlightTable.userId, userId)
      )
    )
    .returning();
  return result ?? null;
}

/**
 * Delete a highlight (with ownership check)
 */
export async function deleteHighlight(
  highlightId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(highlightTable)
    .where(
      and(
        eq(highlightTable.id, highlightId),
        eq(highlightTable.userId, userId)
      )
    )
    .returning({ id: highlightTable.id });
  return result.length > 0;
}
